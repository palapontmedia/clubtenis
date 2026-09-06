import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ReservationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createPendingReservation, cancelReservation } from "@/lib/reservations";
import { AppError } from "@/lib/api-error";
import { zonedTimeToUtc } from "@/lib/timezone";
import { createTestClub, createTestUser, nextWeekdayDateKey } from "./helpers/fixtures";

describe("createPendingReservation", () => {
  let fixture: Awaited<ReturnType<typeof createTestClub>>;
  let userA: Awaited<ReturnType<typeof createTestUser>>;
  let userB: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    fixture = await createTestClub();
    userA = await createTestUser();
    userB = await createTestUser();
  });

  afterEach(async () => {
    await prisma.reservation.deleteMany({ where: { courtId: fixture.court.id } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    await prisma.club.delete({ where: { id: fixture.club.id } });
  });

  it("creates a PENDING_PAYMENT reservation with a server-computed price", async () => {
    const dateKey = nextWeekdayDateKey();
    const startsAt = zonedTimeToUtc(dateKey, "10:00", fixture.club.timezone);
    const endsAt = zonedTimeToUtc(dateKey, "11:00", fixture.club.timezone);

    const reservation = await createPendingReservation({
      createdById: userA.id,
      clubId: fixture.club.id,
      courtId: fixture.court.id,
      startsAt,
      endsAt,
    });

    expect(reservation.status).toBe(ReservationStatus.PENDING_PAYMENT);
    expect(reservation.totalCents).toBe(2000);
    expect(reservation.expiresAt).not.toBeNull();
  });

  it("rejects a reservation that starts in the past", async () => {
    const startsAt = new Date(Date.now() - 3_600_000);
    const endsAt = new Date(Date.now() - 1_800_000);

    await expect(
      createPendingReservation({ createdById: userA.id, clubId: fixture.club.id, courtId: fixture.court.id, startsAt, endsAt })
    ).rejects.toThrow(AppError);
  });

  // SEC-01: the write path must enforce the same opening-hours / slot-grid
  // invariants getAvailability() applies, so a crafted POST can't create an
  // out-of-hours, off-grid or run-past-closing hold the search UI would
  // never have offered. Fixture club opens 08:00-22:00 every day.
  it("rejects a booking that starts before opening hours", async () => {
    const dateKey = nextWeekdayDateKey();
    const startsAt = zonedTimeToUtc(dateKey, "06:00", fixture.club.timezone);
    const endsAt = zonedTimeToUtc(dateKey, "07:00", fixture.club.timezone);

    await expect(
      createPendingReservation({ createdById: userA.id, clubId: fixture.club.id, courtId: fixture.court.id, startsAt, endsAt })
    ).rejects.toMatchObject({ code: "OUTSIDE_BOOKING_HOURS", status: 422 });
  });

  it("rejects a booking that runs past closing time", async () => {
    const dateKey = nextWeekdayDateKey();
    const startsAt = zonedTimeToUtc(dateKey, "21:30", fixture.club.timezone); // +90m -> 23:00, club closes 22:00
    const endsAt = zonedTimeToUtc(dateKey, "23:00", fixture.club.timezone);

    await expect(
      createPendingReservation({ createdById: userA.id, clubId: fixture.club.id, courtId: fixture.court.id, startsAt, endsAt })
    ).rejects.toMatchObject({ code: "OUTSIDE_BOOKING_HOURS", status: 422 });
  });

  it("rejects a booking not aligned to the 30-minute slot grid", async () => {
    const dateKey = nextWeekdayDateKey();
    const startsAt = zonedTimeToUtc(dateKey, "10:07", fixture.club.timezone);
    const endsAt = zonedTimeToUtc(dateKey, "11:07", fixture.club.timezone);

    await expect(
      createPendingReservation({ createdById: userA.id, clubId: fixture.club.id, courtId: fixture.court.id, startsAt, endsAt })
    ).rejects.toMatchObject({ code: "OUTSIDE_BOOKING_HOURS", status: 422 });
  });

  it("rejects a sequential booking attempt on an already-taken slot with SLOT_TAKEN", async () => {
    // This is the case the /booking/new hand-off page (reached after an
    // anonymous user logs in or registers) depends on: by the time the
    // user comes back authenticated, someone else may have already booked
    // the slot they picked. createPendingReservation() must re-validate
    // and reject it with a clear, user-facing error — never silently
    // succeed on stale availability.
    const dateKey = nextWeekdayDateKey();
    const startsAt = zonedTimeToUtc(dateKey, "16:00", fixture.club.timezone);
    const endsAt = zonedTimeToUtc(dateKey, "17:00", fixture.club.timezone);

    await createPendingReservation({ createdById: userA.id, clubId: fixture.club.id, courtId: fixture.court.id, startsAt, endsAt });

    await expect(
      createPendingReservation({ createdById: userB.id, clubId: fixture.club.id, courtId: fixture.court.id, startsAt, endsAt })
    ).rejects.toMatchObject({ code: "SLOT_TAKEN", status: 409 });
  });

  it("never allows two concurrent bookings to double-book the same slot", async () => {
    const dateKey = nextWeekdayDateKey();
    const startsAt = zonedTimeToUtc(dateKey, "14:00", fixture.club.timezone);
    const endsAt = zonedTimeToUtc(dateKey, "15:00", fixture.club.timezone);

    const [resultA, resultB] = await Promise.allSettled([
      createPendingReservation({ createdById: userA.id, clubId: fixture.club.id, courtId: fixture.court.id, startsAt, endsAt }),
      createPendingReservation({ createdById: userB.id, clubId: fixture.club.id, courtId: fixture.court.id, startsAt, endsAt }),
    ]);

    const outcomes = [resultA, resultB];
    const fulfilled = outcomes.filter((r) => r.status === "fulfilled");
    const rejected = outcomes.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0]?.status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(AppError);
    }

    const rows = await prisma.reservation.findMany({
      where: { courtId: fixture.court.id, startsAt, status: { in: ["PENDING_PAYMENT", "CONFIRMED"] } },
    });
    expect(rows).toHaveLength(1);
  });
});

describe("cancelReservation", () => {
  let fixture: Awaited<ReturnType<typeof createTestClub>>;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let stranger: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    fixture = await createTestClub();
    owner = await createTestUser();
    stranger = await createTestUser();

    await prisma.cancellationPolicy.create({
      data: {
        clubId: fixture.club.id,
        name: "Standard",
        isDefault: true,
        tiers: {
          create: [
            { minHoursBefore: 24, refundPercentage: 100 },
            { minHoursBefore: 12, refundPercentage: 50 },
            { minHoursBefore: 0, refundPercentage: 0 },
          ],
        },
      },
    });
  });

  afterEach(async () => {
    await prisma.payment.deleteMany({ where: { reservation: { courtId: fixture.court.id } } });
    await prisma.reservation.deleteMany({ where: { courtId: fixture.court.id } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, stranger.id] } } });
    await prisma.club.delete({ where: { id: fixture.club.id } });
  });

  async function makeConfirmedReservation(hoursFromNow: number) {
    const startsAt = new Date(Date.now() + hoursFromNow * 3_600_000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
    const reservation = await prisma.reservation.create({
      data: {
        clubId: fixture.club.id,
        courtId: fixture.court.id,
        sportId: fixture.sport.id,
        createdById: owner.id,
        startsAt,
        endsAt,
        status: ReservationStatus.CONFIRMED,
        priceCents: 2000,
        totalCents: 2000,
      },
    });
    await prisma.payment.create({
      data: {
        reservationId: reservation.id,
        userId: owner.id,
        idempotencyKey: `test:${reservation.id}`,
        amountCents: 2000,
        status: "SUCCEEDED",
      },
    });
    return reservation;
  }

  it("refunds 100% when cancelled well in advance", async () => {
    const reservation = await makeConfirmedReservation(48);
    const result = await cancelReservation({ reservationId: reservation.id, actingUserId: owner.id, isStaff: false });
    expect(result.refundPercentage).toBe(100);
    expect(result.refundCents).toBe(2000);
  });

  it("refunds nothing when cancelled last minute", async () => {
    const reservation = await makeConfirmedReservation(2);
    const result = await cancelReservation({ reservationId: reservation.id, actingUserId: owner.id, isStaff: false });
    expect(result.refundPercentage).toBe(0);
    expect(result.refundCents).toBe(0);
  });

  it("forbids a player from cancelling someone else's reservation", async () => {
    const reservation = await makeConfirmedReservation(48);
    await expect(
      cancelReservation({ reservationId: reservation.id, actingUserId: stranger.id, isStaff: false })
    ).rejects.toThrow(AppError);
  });

  it("allows staff to cancel any reservation with a full refund override", async () => {
    const reservation = await makeConfirmedReservation(1);
    const result = await cancelReservation({ reservationId: reservation.id, actingUserId: stranger.id, isStaff: true });
    expect(result.refundPercentage).toBe(100);
  });

  it("refuses to cancel an already-cancelled reservation", async () => {
    const reservation = await makeConfirmedReservation(48);
    await cancelReservation({ reservationId: reservation.id, actingUserId: owner.id, isStaff: false });

    await expect(
      cancelReservation({ reservationId: reservation.id, actingUserId: owner.id, isStaff: false })
    ).rejects.toThrow(AppError);
  });

  // SEC-04: two concurrent cancels must not both proceed to a refund. Only
  // the one that wins the conditional status transition returns a refund
  // amount; the other fails with NOT_CANCELLABLE.
  it("lets only one of two concurrent cancels perform the cancellation", async () => {
    const reservation = await makeConfirmedReservation(48);

    const [a, b] = await Promise.allSettled([
      cancelReservation({ reservationId: reservation.id, actingUserId: owner.id, isStaff: false }),
      cancelReservation({ reservationId: reservation.id, actingUserId: owner.id, isStaff: false }),
    ]);

    const fulfilled = [a, b].filter((r) => r.status === "fulfilled");
    const rejected = [a, b].filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (fulfilled[0]?.status === "fulfilled") {
      expect(fulfilled[0].value.refundCents).toBe(2000);
    }

    const row = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(row.status).toBe(ReservationStatus.CANCELLED);
  });
});
