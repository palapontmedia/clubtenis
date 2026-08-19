import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { computePrice } from "@/lib/pricing";
import { zonedTimeToUtc } from "@/lib/timezone";
import { createTestClub, nextWeekdayDateKey, nextWeekendDateKey } from "./helpers/fixtures";

describe("computePrice", () => {
  let fixture: Awaited<ReturnType<typeof createTestClub>>;

  beforeAll(async () => {
    fixture = await createTestClub();
  });

  afterAll(async () => {
    await prisma.club.delete({ where: { id: fixture.club.id } });
  });

  it("applies the off-peak weekday rate", async () => {
    const dateKey = nextWeekdayDateKey();
    const startsAt = zonedTimeToUtc(dateKey, "10:00", fixture.club.timezone);
    const endsAt = zonedTimeToUtc(dateKey, "11:00", fixture.club.timezone);

    const result = await computePrice({
      clubId: fixture.club.id,
      sportId: fixture.sport.id,
      courtTypeId: fixture.courtType.id,
      startsAt,
      endsAt,
      fallbackPricePerHourCents: fixture.court.basePriceCents,
      currency: "EUR",
    });

    expect(result.priceCents).toBe(2000);
    expect(result.dayCategory).toBe("WEEKDAY");
  });

  it("applies the peak weekday rate", async () => {
    const dateKey = nextWeekdayDateKey();
    const startsAt = zonedTimeToUtc(dateKey, "19:00", fixture.club.timezone);
    const endsAt = zonedTimeToUtc(dateKey, "20:30", fixture.club.timezone);

    const result = await computePrice({
      clubId: fixture.club.id,
      sportId: fixture.sport.id,
      courtTypeId: fixture.courtType.id,
      startsAt,
      endsAt,
      fallbackPricePerHourCents: fixture.court.basePriceCents,
      currency: "EUR",
    });

    // 90 minutes at 30 EUR/hour = 45.00 EUR
    expect(result.priceCents).toBe(4500);
  });

  it("prorates a reservation that straddles the peak boundary", async () => {
    const dateKey = nextWeekdayDateKey();
    const startsAt = zonedTimeToUtc(dateKey, "17:30", fixture.club.timezone);
    const endsAt = zonedTimeToUtc(dateKey, "18:30", fixture.club.timezone);

    const result = await computePrice({
      clubId: fixture.club.id,
      sportId: fixture.sport.id,
      courtTypeId: fixture.courtType.id,
      startsAt,
      endsAt,
      fallbackPricePerHourCents: fixture.court.basePriceCents,
      currency: "EUR",
    });

    // 30 min off-peak (10.00) + 30 min peak (15.00) = 25.00 EUR
    expect(result.priceCents).toBe(2500);
    expect(result.breakdown).toHaveLength(2);
  });

  it("applies the weekend rate regardless of time of day", async () => {
    const dateKey = nextWeekendDateKey();
    const startsAt = zonedTimeToUtc(dateKey, "09:00", fixture.club.timezone);
    const endsAt = zonedTimeToUtc(dateKey, "10:00", fixture.club.timezone);

    const result = await computePrice({
      clubId: fixture.club.id,
      sportId: fixture.sport.id,
      courtTypeId: fixture.courtType.id,
      startsAt,
      endsAt,
      fallbackPricePerHourCents: fixture.court.basePriceCents,
      currency: "EUR",
    });

    expect(result.priceCents).toBe(2500);
    expect(result.dayCategory).toBe("WEEKEND");
  });

  it("falls back to the court's base price when no rule matches", async () => {
    const otherSport = await prisma.sport.create({ data: { name: "Squash", slug: `squash-${Date.now()}` } });
    const dateKey = nextWeekdayDateKey();
    const startsAt = zonedTimeToUtc(dateKey, "10:00", fixture.club.timezone);
    const endsAt = zonedTimeToUtc(dateKey, "11:00", fixture.club.timezone);

    const result = await computePrice({
      clubId: fixture.club.id,
      sportId: otherSport.id,
      courtTypeId: null,
      startsAt,
      endsAt,
      fallbackPricePerHourCents: fixture.court.basePriceCents,
      currency: "EUR",
    });

    expect(result.priceCents).toBe(fixture.court.basePriceCents);
    await prisma.sport.delete({ where: { id: otherSport.id } });
  });
});
