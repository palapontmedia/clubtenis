"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ReservationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { computePrice } from "@/lib/pricing";
import { isCourtWindowFree } from "@/lib/availability";
import { cancelReservation } from "@/lib/reservations";
import { refundPayment } from "@/lib/payments";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { zonedTimeToUtc } from "@/lib/timezone";

const manualReservationSchema = z.object({
  clubId: z.string().min(1),
  courtId: z.string().min(1),
  userId: z.string().min(1),
  // From an <input type="datetime-local">: "YYYY-MM-DDTHH:mm", with no
  // timezone info. Always interpreted as wall-clock time in the club's own
  // timezone (never the server's), same as every other time in this app.
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  durationMinutes: z.coerce.number().int().min(30).max(240),
  notes: z.string().trim().max(500).optional(),
});

/**
 * Staff-created bookings (phone/walk-in) skip the online payment flow and
 * go straight to CONFIRMED — the club has already taken payment offline
 * (cash, terminal) or is comping the court. Price is still computed
 * server-side from the pricing engine, never entered free-hand, so it
 * stays consistent with what a player would have paid online.
 */
export async function createManualReservation(formData: FormData) {
  const staff = await requireRole("STAFF");
  const data = manualReservationSchema.parse(Object.fromEntries(formData.entries()));

  const court = await prisma.court.findUniqueOrThrow({ where: { id: data.courtId }, include: { club: true } });

  const [dateKey, hhmm] = data.startsAt.split("T");
  const startsAt = zonedTimeToUtc(dateKey, hhmm, court.club.timezone);
  const endsAt = new Date(startsAt.getTime() + data.durationMinutes * 60_000);

  const free = await isCourtWindowFree(data.courtId, startsAt, endsAt);
  if (!free) {
    throw new Error("Esa franja horaria ya no está disponible.");
  }

  const price = await computePrice({
    clubId: data.clubId,
    sportId: court.sportId,
    courtTypeId: court.courtTypeId,
    startsAt,
    endsAt,
    fallbackPricePerHourCents: court.basePriceCents,
    currency: court.club.currency,
  });

  const reservation = await prisma.reservation.create({
    data: {
      clubId: data.clubId,
      courtId: data.courtId,
      sportId: court.sportId,
      createdById: data.userId,
      startsAt,
      endsAt,
      status: ReservationStatus.CONFIRMED,
      priceCents: price.priceCents,
      totalCents: price.priceCents,
      currency: court.club.currency,
      notes: data.notes,
      participants: { create: { userId: data.userId } },
    },
  });

  await notify({
    userId: data.userId,
    type: "RESERVATION_CONFIRMED",
    reservationId: reservation.id,
    title: "Reserva confirmada",
    body: "El club ha creado una reserva a tu nombre.",
  });

  await logAudit({
    actorUserId: staff.id,
    action: "RESERVATION_CREATED_MANUALLY",
    entityType: "Reservation",
    entityId: reservation.id,
    metadata: { courtId: data.courtId, userId: data.userId, startsAt, endsAt },
  });

  revalidatePath("/admin/reservations");
  revalidatePath("/admin/calendar");
}

export async function adminCancelReservation(formData: FormData) {
  const staff = await requireRole("STAFF");
  const id = String(formData.get("id"));
  const reason = String(formData.get("reason") ?? "Cancelada por el club");

  const { refundCents } = await cancelReservation({
    reservationId: id,
    actingUserId: staff.id,
    isStaff: true,
    reason,
  });

  if (refundCents > 0) {
    const payment = await prisma.payment.findFirst({ where: { reservationId: id, status: "SUCCEEDED" }, orderBy: { createdAt: "desc" } });
    if (payment) await refundPayment(payment.id, refundCents, reason);
  }

  const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id } });
  await notify({
    userId: reservation.createdById,
    type: "RESERVATION_CANCELLED",
    reservationId: id,
    title: "Reserva cancelada por el club",
    body: reason,
  });

  revalidatePath("/admin/reservations");
  revalidatePath("/admin/calendar");
}

export async function markNoShow(formData: FormData) {
  const staff = await requireRole("STAFF");
  const id = String(formData.get("id"));

  await prisma.reservation.update({ where: { id }, data: { status: ReservationStatus.NO_SHOW } });
  await logAudit({ actorUserId: staff.id, action: "RESERVATION_NO_SHOW", entityType: "Reservation", entityId: id });

  revalidatePath("/admin/reservations");
  revalidatePath("/admin/calendar");
}
