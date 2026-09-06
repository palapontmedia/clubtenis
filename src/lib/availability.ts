import { ReservationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { computePriceFromContext, getPricingContext } from "@/lib/pricing";
import { getZonedParts, timeStringToMinutes, zonedTimeToUtc } from "@/lib/timezone";
import { SLOT_STEP_MINUTES } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { ALLOWED_DURATIONS_MINUTES } from "@/lib/validation/reservations";

const BLOCKING_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING_PAYMENT,
  ReservationStatus.CONFIRMED,
];

interface Interval {
  start: number; // epoch ms
  end: number; // epoch ms
}

function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end;
}

/**
 * Lazily flips stale PENDING_PAYMENT reservations to EXPIRED. Called before
 * every availability read and every booking attempt so a missed cron tick
 * never makes a slot look falsely unavailable. A scheduled sweep
 * (/api/cron/expire-reservations) also runs this globally as a backstop.
 */
export async function expireStalePendingReservations(courtIds?: string[]) {
  await prisma.reservation.updateMany({
    where: {
      status: ReservationStatus.PENDING_PAYMENT,
      expiresAt: { lt: new Date() },
      ...(courtIds ? { courtId: { in: courtIds } } : {}),
    },
    data: { status: ReservationStatus.EXPIRED },
  });
}

export interface AvailableSlot {
  courtId: string;
  courtName: string;
  courtIndoor: boolean;
  courtCovered: boolean;
  courtTypeId: string | null;
  courtTypeName: string | null;
  startsAt: Date;
  endsAt: Date;
  priceCents: number;
  currency: string;
}

export async function getAvailability(params: {
  clubId: string;
  sportId: string;
  dateKey: string; // "YYYY-MM-DD", club-local calendar date
  durationMinutes: number;
}): Promise<AvailableSlot[]> {
  const { clubId, sportId, dateKey, durationMinutes } = params;

  const club = await prisma.club.findUniqueOrThrow({ where: { id: clubId } });

  const dayOfWeek = getZonedParts(zonedTimeToUtc(dateKey, "12:00", club.timezone), club.timezone).dayOfWeek;

  // Opening hours and the court list depend on independent inputs (neither
  // needs the other's result), so fetch them concurrently instead of
  // back-to-back.
  const [openingHours, courts] = await Promise.all([
    prisma.clubOpeningHours.findUnique({ where: { clubId_dayOfWeek: { clubId, dayOfWeek } } }),
    prisma.court.findMany({
      where: { clubId, sportId, active: true },
      select: {
        id: true,
        name: true,
        indoor: true,
        covered: true,
        courtTypeId: true,
        basePriceCents: true,
        sortOrder: true,
        courtType: { select: { name: true } },
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  if (!openingHours || openingHours.closed) return [];
  if (courts.length === 0) return [];
  const courtIds = courts.map((c) => c.id);

  // Pricing rules/holiday status only depend on (clubId, sportId, dateKey)
  // — not on which reservations currently block which court — so this can
  // run alongside the stale-hold sweep instead of after it. The reservation
  // sweep itself must still finish before the reservations/closures read
  // below, so a just-expired hold isn't mistaken for a live block.
  const [, pricingContext] = await Promise.all([
    expireStalePendingReservations(courtIds),
    getPricingContext({ clubId, sportId, dateKey, dayOfWeek }),
  ]);

  const dayStart = zonedTimeToUtc(dateKey, "00:00", club.timezone);
  const dayEnd = zonedTimeToUtc(dateKey, "23:59", club.timezone);
  const windowEnd = new Date(dayEnd.getTime() + 24 * 60 * 60_000); // cover slots ending after midnight-ish edge cases

  const [reservations, closures] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        courtId: { in: courtIds },
        status: { in: BLOCKING_STATUSES },
        startsAt: { lt: windowEnd },
        endsAt: { gt: dayStart },
      },
      select: { courtId: true, startsAt: true, endsAt: true },
    }),
    prisma.courtClosure.findMany({
      where: {
        courtId: { in: courtIds },
        startsAt: { lt: windowEnd },
        endsAt: { gt: dayStart },
      },
      select: { courtId: true, startsAt: true, endsAt: true },
    }),
  ]);

  const blockersByCourtId = new Map<string, Interval[]>();
  for (const courtId of courtIds) blockersByCourtId.set(courtId, []);
  for (const r of reservations) blockersByCourtId.get(r.courtId)?.push({ start: r.startsAt.getTime(), end: r.endsAt.getTime() });
  for (const c of closures) blockersByCourtId.get(c.courtId)?.push({ start: c.startsAt.getTime(), end: c.endsAt.getTime() });

  const openMinutes = timeStringToMinutes(openingHours.opensAt);
  const closeMinutes = timeStringToMinutes(openingHours.closesAt);

  const slots: AvailableSlot[] = [];
  const now = Date.now();

  for (let startMinutes = openMinutes; startMinutes + durationMinutes <= closeMinutes; startMinutes += SLOT_STEP_MINUTES) {
    const startsAt = zonedTimeToUtc(dateKey, minutesToHHMM(startMinutes), club.timezone);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
    if (startsAt.getTime() <= now) continue; // no bookings in the past

    const candidate: Interval = { start: startsAt.getTime(), end: endsAt.getTime() };

    for (const court of courts) {
      const blockers = blockersByCourtId.get(court.id) ?? [];
      const blocked = blockers.some((b) => overlaps(candidate, b));
      if (blocked) continue;

      const price = computePriceFromContext(
        {
          courtTypeId: court.courtTypeId,
          startMinutes,
          durationMinutes,
          fallbackPricePerHourCents: court.basePriceCents,
          currency: club.currency,
        },
        pricingContext
      );

      slots.push({
        courtId: court.id,
        courtName: court.name,
        courtIndoor: court.indoor,
        courtCovered: court.covered,
        courtTypeId: court.courtTypeId,
        courtTypeName: court.courtType?.name ?? null,
        startsAt,
        endsAt,
        priceCents: price.priceCents,
        currency: price.currency,
      });
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Server-side guard that a requested booking window is one the public
 * booking flow is actually allowed to create: an allowed duration, inside
 * the club's opening hours for that day, aligned to the same slot grid
 * getAvailability() offers, and finishing before closing. getAvailability()
 * already enforces all of this for the search UI, but the write path
 * (createPendingReservation) must re-check it independently — the client
 * controls `startsAt`/`durationMinutes` and could otherwise POST a 3am,
 * off-grid, or run-past-closing booking that no slot list would ever have
 * shown, blocking real slots for the price of an unpaid hold.
 *
 * Deliberately NOT applied to staff-created manual bookings, which are
 * allowed off-grid / out-of-hours by design.
 */
export async function assertBookableWindow(params: {
  clubId: string;
  timezone: string;
  startsAt: Date;
  endsAt: Date;
}): Promise<void> {
  const { clubId, timezone, startsAt, endsAt } = params;

  const durationMinutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  if (!(ALLOWED_DURATIONS_MINUTES as readonly number[]).includes(durationMinutes)) {
    throw new AppError("Duración de reserva no válida.", 422, "INVALID_DURATION");
  }

  const start = getZonedParts(startsAt, timezone);

  const openingHours = await prisma.clubOpeningHours.findUnique({
    where: { clubId_dayOfWeek: { clubId, dayOfWeek: start.dayOfWeek } },
  });
  if (!openingHours || openingHours.closed) {
    throw new AppError("El club está cerrado ese día.", 422, "CLUB_CLOSED");
  }

  const openMinutes = timeStringToMinutes(openingHours.opensAt);
  const closeMinutes = timeStringToMinutes(openingHours.closesAt);
  const startMinutes = start.minutesSinceMidnight;

  // Exactly the acceptance criteria of getAvailability()'s slot loop:
  // start on/after opening, aligned to the grid measured from opening,
  // and the whole window fits before closing.
  const onGrid =
    startMinutes >= openMinutes && (startMinutes - openMinutes) % SLOT_STEP_MINUTES === 0;
  const fitsBeforeClose = startMinutes + durationMinutes <= closeMinutes;

  if (!onGrid || !fitsBeforeClose) {
    throw new AppError(
      "Esa franja horaria no está disponible para reservar.",
      422,
      "OUTSIDE_BOOKING_HOURS"
    );
  }
}

/**
 * Re-validates that a specific court+time window is still free. Used as
 * the final server-side guard right before creating a reservation — the
 * availability list the client saw may be a few seconds stale.
 */
export async function isCourtWindowFree(courtId: string, startsAt: Date, endsAt: Date) {
  await expireStalePendingReservations([courtId]);
  const conflict = await prisma.reservation.findFirst({
    where: {
      courtId,
      status: { in: BLOCKING_STATUSES },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  });
  if (conflict) return false;

  const closure = await prisma.courtClosure.findFirst({
    where: {
      courtId,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  });
  return !closure;
}
