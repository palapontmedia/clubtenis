import { DayCategory } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getZonedParts, timeStringToMinutes } from "@/lib/timezone";

export interface PriceBreakdownSegment {
  fromMinutes: number;
  toMinutes: number;
  pricePerHourCents: number;
  ruleId: string | null;
  ruleName: string;
}

export interface PriceResult {
  priceCents: number;
  currency: string;
  dayCategory: DayCategory;
  breakdown: PriceBreakdownSegment[];
}

/**
 * Computes the price of a reservation window server-side. The price is
 * NEVER trusted from the client: every code path that creates or confirms
 * a reservation must call this with the club/court/sport/time it looked up
 * itself, not with a price the frontend sent.
 *
 * Handles reservations that straddle a rate change (e.g. a 90-minute slot
 * that starts in off-peak and ends in peak hours) by splitting the window
 * at every rule boundary and pricing each segment individually.
 */
export async function computePrice(params: {
  clubId: string;
  sportId: string;
  courtTypeId: string | null;
  startsAt: Date;
  endsAt: Date;
  fallbackPricePerHourCents: number;
  currency: string;
}): Promise<PriceResult> {
  const { clubId, sportId, courtTypeId, startsAt, endsAt, fallbackPricePerHourCents, currency } = params;

  const club = await prisma.club.findUniqueOrThrow({
    where: { id: clubId },
    select: { timezone: true },
  });

  const startParts = getZonedParts(startsAt, club.timezone);
  const durationMinutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  const startMinutes = startParts.minutesSinceMidnight;
  const endMinutes = startMinutes + durationMinutes;

  const isHoliday = await prisma.clubHoliday.findUnique({
    where: { clubId_date: { clubId, date: new Date(startParts.dateKey) } },
  });

  const dayCategory: DayCategory = isHoliday
    ? DayCategory.HOLIDAY
    : startParts.dayOfWeek === 0 || startParts.dayOfWeek === 6
      ? DayCategory.WEEKEND
      : DayCategory.WEEKDAY;

  const rules = await prisma.pricingRule.findMany({
    where: {
      clubId,
      sportId,
      active: true,
      dayCategory,
      OR: [{ courtTypeId }, { courtTypeId: null }],
    },
    orderBy: [{ priority: "desc" }],
  });

  // Collect breakpoints (rule starts/ends) that fall strictly inside the
  // reservation window, so every segment has a constant applicable rule.
  const breakpoints = new Set<number>([startMinutes, endMinutes]);
  for (const rule of rules) {
    const ruleStart = timeStringToMinutes(rule.startTime);
    const ruleEnd = timeStringToMinutes(rule.endTime);
    if (ruleStart > startMinutes && ruleStart < endMinutes) breakpoints.add(ruleStart);
    if (ruleEnd > startMinutes && ruleEnd < endMinutes) breakpoints.add(ruleEnd);
  }
  const sortedBreakpoints = [...breakpoints].sort((a, b) => a - b);

  const breakdown: PriceBreakdownSegment[] = [];
  let totalCentsFractional = 0;

  for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
    const from = sortedBreakpoints[i];
    const to = sortedBreakpoints[i + 1];
    const midpoint = (from + to) / 2;

    const matching = rules
      .filter((r) => timeStringToMinutes(r.startTime) <= midpoint && timeStringToMinutes(r.endTime) > midpoint)
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        // More specific (court-type scoped) rules win over club-wide ones.
        return (b.courtTypeId ? 1 : 0) - (a.courtTypeId ? 1 : 0);
      });

    const best = matching[0];
    const pricePerHourCents = best?.pricePerHourCents ?? fallbackPricePerHourCents;
    const segmentMinutes = to - from;
    totalCentsFractional += (pricePerHourCents * segmentMinutes) / 60;

    breakdown.push({
      fromMinutes: from,
      toMinutes: to,
      pricePerHourCents,
      ruleId: best?.id ?? null,
      ruleName: best?.name ?? "Tarifa base",
    });
  }

  return {
    priceCents: Math.round(totalCentsFractional),
    currency,
    dayCategory,
    breakdown,
  };
}
