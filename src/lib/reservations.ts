import { Prisma, ReservationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { computePrice } from "@/lib/pricing";
import { assertBookableWindow, isCourtWindowFree } from "@/lib/availability";
import { computeRefundPercentage, getDefaultCancellationPolicy } from "@/lib/cancellation";
import { AppError } from "@/lib/errors";
import { RESERVATION_HOLD_MINUTES } from "@/lib/config";
import { logAudit } from "@/lib/audit";

export interface CreatePendingReservationInput {
  createdById: string;
  clubId: string;
  courtId: string;
  startsAt: Date;
  endsAt: Date;
  promoCode?: string;
  notes?: string;
}

/**
 * Creates a PENDING_PAYMENT reservation and holds the court for
 * RESERVATION_HOLD_MINUTES while the user completes payment.
 *
 * Concurrency: this function re-checks the window right before inserting
 * (cheap, avoids most races), but the actual guarantee against
 * double-booking is the `Reservation_no_overlap_per_court` GiST exclusion
 * constraint in Postgres — see prisma/migrations/*_init. If two requests
 * race past the pre-check, only one INSERT can succeed; the loser's
 * failure is turned into a friendly 409 by re-checking availability.
 */
export async function createPendingReservation(input: CreatePendingReservationInput) {
  const { createdById, clubId, courtId, startsAt, endsAt, promoCode, notes } = input;

  if (startsAt.getTime() <= Date.now()) {
    throw new AppError("No se puede reservar en el pasado.", 422, "PAST_START_TIME");
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new AppError("Rango horario inválido.", 422, "INVALID_RANGE");
  }

  const court = await prisma.court.findUnique({
    where: { id: courtId },
    include: { club: true },
  });
  if (!court || court.clubId !== clubId || !court.active) {
    throw new AppError("Pista no disponible.", 404, "COURT_NOT_FOUND");
  }

  // The client picks startsAt/duration from getAvailability()'s output, but
  // nothing stops it POSTing an arbitrary instant. Re-enforce the same
  // opening-hours / slot-grid / duration invariants server-side before we
  // hold the court.
  await assertBookableWindow({ clubId, timezone: court.club.timezone, startsAt, endsAt });

  const free = await isCourtWindowFree(courtId, startsAt, endsAt);
  if (!free) {
    throw new AppError("Esa franja horaria ya no está disponible.", 409, "SLOT_TAKEN");
  }

  const price = await computePrice({
    clubId,
    sportId: court.sportId,
    courtTypeId: court.courtTypeId,
    startsAt,
    endsAt,
    fallbackPricePerHourCents: court.basePriceCents,
    currency: court.club.currency,
  });

  let discountCents = 0;
  let promoCodeId: string | null = null;
  let promoMaxRedemptions: number | null = null;
  if (promoCode) {
    const applied = await validateAndPricePromoCode(promoCode, clubId, court.sportId, price.priceCents);
    discountCents = applied.discountCents;
    promoCodeId = applied.promoCodeId;
    promoMaxRedemptions = applied.maxRedemptions;
  }

  const totalCents = Math.max(0, price.priceCents - discountCents);
  const expiresAt = new Date(Date.now() + RESERVATION_HOLD_MINUTES * 60_000);

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const created = await tx.reservation.create({
        data: {
          clubId,
          courtId,
          sportId: court.sportId,
          createdById,
          startsAt,
          endsAt,
          status: ReservationStatus.PENDING_PAYMENT,
          priceCents: price.priceCents,
          discountCents,
          totalCents,
          currency: court.club.currency,
          promoCodeId,
          expiresAt,
          notes,
          participants: { create: { userId: createdById } },
        },
      });

      if (promoCodeId) {
        // Enforce maxRedemptions atomically here — this is the only check
        // that actually counts under concurrency. The earlier read in
        // validateAndPricePromoCode is just an optimistic pre-check for a
        // fast error message; without this conditional update, two
        // concurrent requests on the last remaining redemption could both
        // pass that pre-check and over-redeem the code.
        if (promoMaxRedemptions !== null) {
          const result = await tx.promoCode.updateMany({
            where: { id: promoCodeId, redemptionCount: { lt: promoMaxRedemptions } },
            data: { redemptionCount: { increment: 1 } },
          });
          if (result.count === 0) {
            throw new AppError("Código promocional no válido.", 422, "INVALID_PROMO_CODE");
          }
        } else {
          await tx.promoCode.update({
            where: { id: promoCodeId },
            data: { redemptionCount: { increment: 1 } },
          });
        }
      }

      return created;
    });

    await logAudit({
      actorUserId: createdById,
      action: "RESERVATION_CREATED",
      entityType: "Reservation",
      entityId: reservation.id,
      metadata: { courtId, startsAt, endsAt, totalCents },
    });

    return reservation;
  } catch (error) {
    // The exclusion constraint is the final word on overlap. If we land
    // here it's either that constraint firing (lost the race) or some
    // other DB error; disambiguate by re-checking availability so the
    // user always gets an accurate, friendly message.
    const stillFree = await isCourtWindowFree(courtId, startsAt, endsAt);
    if (!stillFree) {
      throw new AppError("Esa franja horaria ya no está disponible.", 409, "SLOT_TAKEN");
    }
    throw error;
  }
}

async function validateAndPricePromoCode(
  code: string,
  clubId: string,
  sportId: string,
  priceCents: number
): Promise<{ discountCents: number; promoCodeId: string; maxRedemptions: number | null }> {
  const promo = await prisma.promoCode.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { promotion: true },
  });

  const now = new Date();
  const invalid =
    !promo ||
    !promo.active ||
    !promo.promotion.active ||
    promo.promotion.clubId !== clubId ||
    (promo.promotion.sportId && promo.promotion.sportId !== sportId) ||
    promo.promotion.startsAt > now ||
    promo.promotion.endsAt < now ||
    (promo.expiresAt && promo.expiresAt < now) ||
    (promo.maxRedemptions !== null && promo.redemptionCount >= promo.maxRedemptions);

  if (invalid || !promo) {
    throw new AppError("Código promocional no válido.", 422, "INVALID_PROMO_CODE");
  }

  const rawDiscountCents =
    promo.promotion.discountType === "PERCENTAGE"
      ? Math.round((priceCents * promo.promotion.discountValue) / 100)
      : promo.promotion.discountValue;
  // A discount can never exceed the price or go negative, whatever a
  // misconfigured promotion says — the total is always in [0, priceCents].
  const discountCents = Math.max(0, Math.min(priceCents, rawDiscountCents));

  return { discountCents, promoCodeId: promo.id, maxRedemptions: promo.maxRedemptions };
}

export class ReservationNoLongerAvailableError extends Error {
  constructor() {
    super("La reserva ya no está pendiente de pago.");
    this.name = "ReservationNoLongerAvailableError";
  }
}

/** Called from the Stripe webhook once a payment has actually succeeded. */
export async function confirmReservationAfterPayment(reservationId: string) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUniqueOrThrow({ where: { id: reservationId } });

    if (reservation.status === ReservationStatus.CONFIRMED) {
      return reservation; // idempotent: webhook may be delivered more than once
    }
    if (reservation.status !== ReservationStatus.PENDING_PAYMENT) {
      // The hold expired (or was cancelled) before the payment webhook
      // arrived. The caller (payments module) is responsible for
      // refunding this payment automatically, since the court may now be
      // booked by someone else.
      throw new ReservationNoLongerAvailableError();
    }

    return tx.reservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CONFIRMED, expiresAt: null },
    });
  });
}

export interface CancelReservationInput {
  reservationId: string;
  actingUserId: string;
  isStaff: boolean;
  reason?: string;
}

export interface CancelReservationResult {
  refundPercentage: number;
  refundCents: number;
}

/**
 * Cancels a reservation and computes (but does not execute) the refund
 * owed under the club's cancellation policy. Executing the actual Stripe
 * refund is the caller's job (src/lib/payments.ts) so this function stays
 * pure DB + policy logic and is easy to unit test.
 */
export async function cancelReservation(input: CancelReservationInput): Promise<CancelReservationResult> {
  const { reservationId, actingUserId, isStaff, reason } = input;

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { payments: true },
  });
  if (!reservation) throw new AppError("Reserva no encontrada.", 404, "RESERVATION_NOT_FOUND");

  if (!isStaff && reservation.createdById !== actingUserId) {
    throw new AppError("No puedes cancelar la reserva de otro jugador.", 403, "FORBIDDEN");
  }
  const cancellableStatuses: ReservationStatus[] = [ReservationStatus.PENDING_PAYMENT, ReservationStatus.CONFIRMED];
  if (!cancellableStatuses.includes(reservation.status) || reservation.startsAt.getTime() <= Date.now()) {
    throw new AppError("Esta reserva ya no se puede cancelar.", 422, "NOT_CANCELLABLE");
  }

  let refundPercentage = 0;
  const successfulPayment = reservation.payments.find((p) => p.status === "SUCCEEDED");

  if (reservation.status === ReservationStatus.CONFIRMED && successfulPayment) {
    const policy = await getDefaultCancellationPolicy(reservation.clubId);
    const hoursUntilStart = (reservation.startsAt.getTime() - Date.now()) / 3_600_000;
    refundPercentage = isStaff
      ? 100
      : computeRefundPercentage(policy?.tiers ?? [], hoursUntilStart);
  }

  const refundCents = successfulPayment ? Math.round((successfulPayment.amountCents * refundPercentage) / 100) : 0;

  // Conditional transition: only flip the reservation if it is still in a
  // cancellable state. Two concurrent cancels (double-click, or staff +
  // owner at once) would otherwise both read CONFIRMED, both compute a
  // refund, and both hand a refund amount back to the caller — so the
  // loser must fail here instead of proceeding to refundPayment().
  const transition = await prisma.reservation.updateMany({
    where: { id: reservationId, status: { in: cancellableStatuses } },
    data: {
      status: ReservationStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelledById: actingUserId,
      cancellationReason: reason,
      refundPercentage,
    },
  });
  if (transition.count === 0) {
    throw new AppError("Esta reserva ya no se puede cancelar.", 422, "NOT_CANCELLABLE");
  }

  await logAudit({
    actorUserId: actingUserId,
    action: "RESERVATION_CANCELLED",
    entityType: "Reservation",
    entityId: reservationId,
    metadata: { refundPercentage, refundCents },
  });

  return { refundPercentage, refundCents };
}

export function isPrismaKnownError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}
