import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ReservationStatus, CourtClosureKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getAvailability, isCourtWindowFree } from "@/lib/availability";
import { zonedTimeToUtc } from "@/lib/timezone";
import { createTestClub, createTestUser, nextWeekdayDateKey } from "./helpers/fixtures";

describe("availability", () => {
  let fixture: Awaited<ReturnType<typeof createTestClub>>;
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    fixture = await createTestClub();
    user = await createTestUser();
  });

  afterEach(async () => {
    await prisma.reservation.deleteMany({ where: { courtId: fixture.court.id } });
    await prisma.courtClosure.deleteMany({ where: { courtId: fixture.court.id } });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.club.delete({ where: { id: fixture.club.id } });
  });

  it("lists a free court as available with the correct price", async () => {
    const dateKey = nextWeekdayDateKey();
    const slots = await getAvailability({ clubId: fixture.club.id, sportId: fixture.sport.id, dateKey, durationMinutes: 60 });

    const slot = slots.find((s) => s.courtId === fixture.court.id && s.startsAt.getTime() === zonedTimeToUtc(dateKey, "10:00", fixture.club.timezone).getTime());
    expect(slot).toBeDefined();
    expect(slot?.priceCents).toBe(2000);
  });

  it("excludes a court with an overlapping confirmed reservation", async () => {
    const dateKey = nextWeekdayDateKey();
    const startsAt = zonedTimeToUtc(dateKey, "10:00", fixture.club.timezone);
    const endsAt = zonedTimeToUtc(dateKey, "11:00", fixture.club.timezone);

    await prisma.reservation.create({
      data: {
        clubId: fixture.club.id,
        courtId: fixture.court.id,
        sportId: fixture.sport.id,
        createdById: user.id,
        startsAt,
        endsAt,
        status: ReservationStatus.CONFIRMED,
        priceCents: 2000,
        totalCents: 2000,
      },
    });

    const slots = await getAvailability({ clubId: fixture.club.id, sportId: fixture.sport.id, dateKey, durationMinutes: 60 });
    const slot = slots.find((s) => s.courtId === fixture.court.id && s.startsAt.getTime() === startsAt.getTime());
    expect(slot).toBeUndefined();

    expect(await isCourtWindowFree(fixture.court.id, startsAt, endsAt)).toBe(false);
    // A slot that only partially overlaps must also be rejected.
    const partialOverlapEnd = new Date(endsAt.getTime() + 30 * 60_000);
    expect(await isCourtWindowFree(fixture.court.id, startsAt, partialOverlapEnd)).toBe(false);
  });

  it("excludes a court blocked by a maintenance closure", async () => {
    const dateKey = nextWeekdayDateKey();
    const startsAt = zonedTimeToUtc(dateKey, "10:00", fixture.club.timezone);
    const endsAt = zonedTimeToUtc(dateKey, "11:00", fixture.club.timezone);

    await prisma.courtClosure.create({
      data: { courtId: fixture.court.id, kind: CourtClosureKind.MAINTENANCE, startsAt, endsAt },
    });

    const slots = await getAvailability({ clubId: fixture.club.id, sportId: fixture.sport.id, dateKey, durationMinutes: 60 });
    const slot = slots.find((s) => s.courtId === fixture.court.id && s.startsAt.getTime() === startsAt.getTime());
    expect(slot).toBeUndefined();
  });

  it("never returns slots outside opening hours", async () => {
    const dateKey = nextWeekdayDateKey();
    const slots = await getAvailability({ clubId: fixture.club.id, sportId: fixture.sport.id, dateKey, durationMinutes: 60 });

    const opensAt = zonedTimeToUtc(dateKey, "08:00", fixture.club.timezone).getTime();
    const closesAt = zonedTimeToUtc(dateKey, "22:00", fixture.club.timezone).getTime();

    for (const slot of slots) {
      expect(slot.startsAt.getTime()).toBeGreaterThanOrEqual(opensAt);
      expect(slot.endsAt.getTime()).toBeLessThanOrEqual(closesAt);
    }
  });

  it("treats an expired PENDING_PAYMENT hold as free again", async () => {
    const dateKey = nextWeekdayDateKey();
    const startsAt = zonedTimeToUtc(dateKey, "10:00", fixture.club.timezone);
    const endsAt = zonedTimeToUtc(dateKey, "11:00", fixture.club.timezone);

    const stale = await prisma.reservation.create({
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
        expiresAt: new Date(Date.now() - 60_000), // expired a minute ago
      },
    });

    expect(await isCourtWindowFree(fixture.court.id, startsAt, endsAt)).toBe(true);

    const refreshed = await prisma.reservation.findUniqueOrThrow({ where: { id: stale.id } });
    expect(refreshed.status).toBe(ReservationStatus.EXPIRED);
  });
});
