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
});
