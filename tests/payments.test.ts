import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ReservationStatus, PaymentStatus } from "@prisma/client";
import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { processStripeWebhookEvent } from "@/lib/payments";
import { zonedTimeToUtc } from "@/lib/timezone";
import { createTestClub, createTestUser, nextWeekdayDateKey } from "./helpers/fixtures";

function fakeEvent(id: string, type: string, paymentIntent: Partial<Stripe.PaymentIntent>): Stripe.Event {
  return {
    id,
    type,
    data: { object: paymentIntent },
  } as unknown as Stripe.Event;
}

describe("processStripeWebhookEvent", () => {
  let fixture: Awaited<ReturnType<typeof createTestClub>>;
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    fixture = await createTestClub();
    user = await createTestUser();
  });

  afterEach(async () => {
    await prisma.stripeWebhookEvent.deleteMany({});
    await prisma.payment.deleteMany({ where: { userId: user.id } });
    await prisma.reservation.deleteMany({ where: { courtId: fixture.court.id } });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.club.delete({ where: { id: fixture.club.id } });
  });

  async function makePendingReservationWithPayment(intentId: string) {
    const dateKey = nextWeekdayDateKey();
    const startsAt = zonedTimeToUtc(dateKey, "10:00", fixture.club.timezone);
    const endsAt = zonedTimeToUtc(dateKey, "11:00", fixture.club.timezone);

    const reservation = await prisma.reservation.create({
      data: {
        clubId: fixture.club.id,
        courtId: fixture.court.id,
        sportId: fixture.sport.id,
        createdById: user.id,
        startsAt,
        endsAt,
        status: ReservationStatus.PENDING_PAYMENT,
        priceCents: 2000,
        totalCents: 2000,
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });

    const payment = await prisma.payment.create({
      data: {
        reservationId: reservation.id,
        userId: user.id,
        stripePaymentIntentId: intentId,
        idempotencyKey: `payment-intent:${reservation.id}`,
        amountCents: 2000,
        status: PaymentStatus.PENDING,
      },
    });

    return { reservation, payment };
  }

  it("confirms the reservation and marks the payment succeeded", async () => {
    const intentId = `pi_test_${Date.now()}_a`;
    const { reservation, payment } = await makePendingReservationWithPayment(intentId);

    await processStripeWebhookEvent(fakeEvent(`evt_${intentId}`, "payment_intent.succeeded", { id: intentId }));

    const updatedReservation = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    const updatedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });

    expect(updatedReservation.status).toBe(ReservationStatus.CONFIRMED);
    expect(updatedPayment.status).toBe(PaymentStatus.SUCCEEDED);
  });

  it("is idempotent when the same webhook event is delivered twice", async () => {
    const intentId = `pi_test_${Date.now()}_b`;
    const { reservation } = await makePendingReservationWithPayment(intentId);
    const eventId = `evt_${intentId}`;

    const first = await processStripeWebhookEvent(fakeEvent(eventId, "payment_intent.succeeded", { id: intentId }));
    const second = await processStripeWebhookEvent(fakeEvent(eventId, "payment_intent.succeeded", { id: intentId }));

    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(true);

    // Confirming twice must not throw or double-apply anything: status stays CONFIRMED.
    const updatedReservation = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(updatedReservation.status).toBe(ReservationStatus.CONFIRMED);

    const eventRows = await prisma.stripeWebhookEvent.count({ where: { id: eventId } });
    expect(eventRows).toBe(1);
  });

  it("marks the payment failed without confirming the reservation", async () => {
    const intentId = `pi_test_${Date.now()}_c`;
    const { reservation, payment } = await makePendingReservationWithPayment(intentId);

    await processStripeWebhookEvent(
      fakeEvent(`evt_${intentId}`, "payment_intent.payment_failed", {
        id: intentId,
        last_payment_error: { message: "Your card was declined." } as Stripe.PaymentIntent.LastPaymentError,
      })
    );

    const updatedReservation = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    const updatedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });

    expect(updatedReservation.status).toBe(ReservationStatus.PENDING_PAYMENT);
    expect(updatedPayment.status).toBe(PaymentStatus.FAILED);
    expect(updatedPayment.failureReason).toContain("declined");
  });
});
