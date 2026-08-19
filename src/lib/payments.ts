import { PaymentStatus } from "@prisma/client";
import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { AppError } from "@/lib/api-error";
import { confirmReservationAfterPayment, ReservationNoLongerAvailableError } from "@/lib/reservations";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

/**
 * Creates (or reuses) a Stripe PaymentIntent for a PENDING_PAYMENT
 * reservation. Idempotent by reservationId: calling this twice for the
 * same reservation returns the same PaymentIntent instead of charging
 * twice, both at the Stripe level (Stripe idempotency key) and at our DB
 * level (unique Payment.idempotencyKey).
 */
export async function createPaymentIntentForReservation(reservationId: string, userId: string) {
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!reservation) throw new AppError("Reserva no encontrada.", 404, "RESERVATION_NOT_FOUND");
  if (reservation.createdById !== userId) {
    throw new AppError("No puedes pagar la reserva de otro jugador.", 403, "FORBIDDEN");
  }
  if (reservation.status !== "PENDING_PAYMENT") {
    throw new AppError("Esta reserva ya no está pendiente de pago.", 422, "NOT_PENDING");
  }
  if (reservation.expiresAt && reservation.expiresAt < new Date()) {
    throw new AppError("La reserva ha expirado. Vuelve a seleccionar la pista.", 410, "RESERVATION_EXPIRED");
  }

  const idempotencyKey = `payment-intent:${reservationId}`;

  const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
  if (existing?.stripePaymentIntentId) {
    const intent = await stripe.paymentIntents.retrieve(existing.stripePaymentIntentId);
    return { clientSecret: intent.client_secret, paymentId: existing.id };
  }

  const intent = await stripe.paymentIntents.create(
    {
      amount: reservation.totalCents,
      currency: reservation.currency.toLowerCase(),
      metadata: { reservationId },
      automatic_payment_methods: { enabled: true },
    },
    { idempotencyKey }
  );

  const payment = await prisma.payment.upsert({
    where: { idempotencyKey },
    create: {
      reservationId,
      userId,
      stripePaymentIntentId: intent.id,
      idempotencyKey,
      amountCents: reservation.totalCents,
      currency: reservation.currency,
      status: PaymentStatus.PENDING,
    },
    update: { stripePaymentIntentId: intent.id },
  });

  return { clientSecret: intent.client_secret, paymentId: payment.id };
}

/**
 * Processes a verified Stripe webhook event. Idempotent: every event id is
 * recorded in StripeWebhookEvent before processing, and a replay (Stripe
 * retries on timeout, or a malicious replay of a captured payload) is
 * detected and skipped.
 *
 * This is the ONLY place a reservation is allowed to become CONFIRMED —
 * never the frontend, never the payment-creation endpoint. See section 10
 * of the product spec: "never mark a reservation as paid just because the
 * frontend got a positive response."
 */
export async function processStripeWebhookEvent(event: Stripe.Event) {
  const already = await prisma.stripeWebhookEvent.findUnique({ where: { id: event.id } });
  if (already) return { skipped: true as const };

  await prisma.stripeWebhookEvent.create({
    data: { id: event.id, type: event.type, payload: event as unknown as never },
  });

  switch (event.type) {
    case "payment_intent.succeeded":
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;
    case "payment_intent.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
      break;
    case "payment_intent.canceled":
      await handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
      break;
    default:
      break;
  }

  return { skipped: false as const };
}

async function handlePaymentSucceeded(intent: Stripe.PaymentIntent) {
  const payment = await prisma.payment.findUnique({ where: { stripePaymentIntentId: intent.id } });
  if (!payment) return;

  await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.SUCCEEDED } });

  try {
    await confirmReservationAfterPayment(payment.reservationId);
    await notify({
      userId: payment.userId,
      type: "PAYMENT_CONFIRMED",
      reservationId: payment.reservationId,
      title: "Pago confirmado",
      body: "Tu reserva ha sido confirmada.",
    });
    await notify({
      userId: payment.userId,
      type: "RESERVATION_CONFIRMED",
      reservationId: payment.reservationId,
      title: "Reserva confirmada",
      body: "Tu pista te espera. ¡Nos vemos en la pista!",
    });
  } catch (error) {
    if (error instanceof ReservationNoLongerAvailableError) {
      // The hold expired (or the booking was cancelled) before the payment
      // confirmation arrived, and the court may now belong to someone
      // else. We took the customer's money in good faith, so we refund it
      // automatically rather than leaving them charged with no booking.
      await refundPayment(payment.id, payment.amountCents, "Reserva expirada antes de confirmar el pago");
      await notify({
        userId: payment.userId,
        type: "REFUND_ISSUED",
        reservationId: payment.reservationId,
        title: "Reembolso automático",
        body: "La franja horaria ya no estaba disponible cuando se confirmó tu pago. Te hemos reembolsado el importe completo.",
      });
      return;
    }
    throw error;
  }
}

async function handlePaymentFailed(intent: Stripe.PaymentIntent) {
  const payment = await prisma.payment.findUnique({ where: { stripePaymentIntentId: intent.id } });
  if (!payment) return;

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.FAILED,
      failureReason: intent.last_payment_error?.message ?? "Pago rechazado",
    },
  });

  await notify({
    userId: payment.userId,
    type: "PAYMENT_FAILED",
    reservationId: payment.reservationId,
    title: "El pago no se ha podido procesar",
    body: "Vuelve a intentarlo antes de que expire la reserva temporal.",
  });
}

async function handlePaymentCanceled(intent: Stripe.PaymentIntent) {
  const payment = await prisma.payment.findUnique({ where: { stripePaymentIntentId: intent.id } });
  if (!payment) return;
  await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.CANCELED } });
}

/**
 * Issues a Stripe refund and records it. Idempotent per (paymentId,
 * amountCents) so a cancellation retried by the client (double-click,
 * network retry) never double-refunds.
 */
export async function refundPayment(paymentId: string, amountCents: number, reason: string) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (!payment.stripePaymentIntentId) {
    throw new AppError("El pago no tiene un cargo de Stripe asociado.", 422, "NO_PAYMENT_INTENT");
  }
  if (amountCents <= 0) return null;

  const idempotencyKey = `refund:${paymentId}:${amountCents}`;

  const refund = await stripe.refunds.create(
    {
      payment_intent: payment.stripePaymentIntentId,
      amount: amountCents,
      reason: "requested_by_customer",
      metadata: { paymentId, reason },
    },
    { idempotencyKey }
  );

  const isFullRefund = amountCents >= payment.amountCents;

  await prisma.$transaction([
    prisma.refund.create({
      data: {
        paymentId,
        stripeRefundId: refund.id,
        amountCents,
        reason,
        status: refund.status ?? "PENDING",
      },
    }),
    prisma.payment.update({
      where: { id: paymentId },
      data: { status: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED },
    }),
  ]);

  await logAudit({
    actorUserId: null,
    action: "PAYMENT_REFUNDED",
    entityType: "Payment",
    entityId: paymentId,
    metadata: { amountCents, reason },
  });

  return refund;
}
