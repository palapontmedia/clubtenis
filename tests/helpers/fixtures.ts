import { prisma } from "@/lib/prisma";
import { DayCategory } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Builds a minimal, deterministic club fixture (opening hours, one sport,
 * one court, a couple of pricing rules) for integration tests that need a
 * real Postgres connection — availability, pricing and reservation
 * creation all issue real queries and rely on the GiST exclusion
 * constraint, so mocking Prisma would test nothing meaningful here.
 */
export async function createTestClub() {
  const suffix = Math.random().toString(36).slice(2, 8);

  const club = await prisma.club.create({
    data: {
      name: `Test Club ${suffix}`,
      slug: `test-club-${suffix}`,
      timezone: "Europe/Madrid",
      currency: "EUR",
    },
  });

  const sport = await prisma.sport.create({ data: { name: "Padel", slug: `padel-${suffix}` } });
  const courtType = await prisma.courtType.create({ data: { name: "Panoramica" } });

  const court = await prisma.court.create({
    data: {
      clubId: club.id,
      sportId: sport.id,
      courtTypeId: courtType.id,
      name: "Padel 1",
      basePriceCents: 2000,
    },
  });

  // Open every day 08:00-22:00 so tests don't need to reason about which
  // weekday "today + N days" lands on.
  await prisma.clubOpeningHours.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      clubId: club.id,
      dayOfWeek,
      opensAt: "08:00",
      closesAt: "22:00",
    })),
  });

  await prisma.pricingRule.createMany({
    data: [
      {
        clubId: club.id,
        sportId: sport.id,
        name: "Off-peak",
        dayCategory: DayCategory.WEEKDAY,
        startTime: "08:00",
        endTime: "18:00",
        pricePerHourCents: 2000,
        priority: 1,
      },
      {
        clubId: club.id,
        sportId: sport.id,
        name: "Peak",
        dayCategory: DayCategory.WEEKDAY,
        startTime: "18:00",
        endTime: "22:00",
        pricePerHourCents: 3000,
        priority: 1,
      },
      {
        clubId: club.id,
        sportId: sport.id,
        name: "Weekend",
        dayCategory: DayCategory.WEEKEND,
        startTime: "00:00",
        endTime: "23:59",
        pricePerHourCents: 2500,
        priority: 1,
      },
    ],
  });

  return { club, sport, court, courtType };
}

export async function createTestUser(overrides: { email?: string; role?: "PLAYER" | "STAFF" | "ADMIN" | "SUPER_ADMIN" } = {}) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const passwordHash = await bcrypt.hash("Password123", 4);

  return prisma.user.create({
    data: {
      email: overrides.email ?? `player-${suffix}@example.com`,
      name: `Player ${suffix}`,
      role: overrides.role ?? "PLAYER",
      passwordHash,
    },
  });
}

/** Next Monday at 09:00 UTC-instant-agnostic date key, for weekday-rule tests. */
export function nextWeekdayDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

export function nextWeekendDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}
