import { DayCategory, PricingRule } from "@prisma/client";

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
 * Everything computePrice() needs that only depends on (clubId, sportId,
 * dateKey) — the same for every court/time-slot combination on a given
 * availability search. Callers that price many windows for the same day
 * (getAvailability()'s slot x court loop) fetch this once via
 * getPricingContext() and reuse it with computePriceFromContext(), instead
 * of re-querying the holiday + rules tables on every window.
 */
export interface PricingContext {
  dayCategory: DayCategory;
  rules: PricingRule[];
}

export async function getPricingContext(params: {
  clubId: string;
  sportId: string;
  dateKey: string; // "YYYY-MM-DD", club-local calendar date
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday, club-local
}): Promise<PricingContext> {
  const { clubId, sportId, dateKey, dayOfWeek } = params;

  const isHoliday = await prisma.clubHoliday.findUnique({
    where: { clubId_date: { clubId, date: new Date(dateKey) } },
  });

  const dayCategory: DayCategory = isHoliday
    ? DayCategory.HOLIDAY
    : dayOfWeek === 0 || dayOfWeek === 6
      ? DayCategory.WEEKEND
      : DayCategory.WEEKDAY;

  // Not filtered by courtTypeId here: a search spans every court (and
  // therefore every court type) at once, so we fetch every active rule for
  // the day once and let computePriceFromContext() match courtTypeId
  // per-call in memory instead of re-querying per court.
  const rules = await prisma.pricingRule.findMany({
    where: { clubId, sportId, active: true, dayCategory },
    orderBy: [{ priority: "desc" }],
  });

  return { dayCategory, rules };
}

/**
 * Pure pricing computation (no I/O) for a single window, given a
 * PricingContext already fetched for the relevant (clubId, sportId,
 * dateKey). Handles reservations that straddle a rate change (e.g. a
 * 90-minute slot that starts in off-peak and ends in peak hours) by
 * splitting the window at every rule boundary and pricing each segment
 * individually.
 */
export function computePriceFromContext(
  params: {
    courtTypeId: string | null;
    startMinutes: number;
    durationMinutes: number;
    fallbackPricePerHourCents: number;
    currency: string;
  },
  context: PricingContext
): PriceResult {
  const { courtTypeId, startMinutes, durationMinutes, fallbackPricePerHourCents, currency } = params;
  const { dayCategory, rules } = context;
  const endMinutes = startMinutes + durationMinutes;

  const applicableRules = rules.filter((r) => r.courtTypeId === courtTypeId || r.courtTypeId === null);

  // Collect breakpoints (rule starts/ends) that fall strictly inside the
  // reservation window, so every segment has a constant applicable rule.
  const breakpoints = new Set<number>([startMinutes, endMinutes]);
  for (const rule of applicableRules) {
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

    const matching = applicableRules
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

/**
 * Computes the price of a single reservation window server-side. The price
 * is NEVER trusted from the client: every code path that creates or
 * confirms a reservation must call this with the club/court/sport/time it
 * looked up itself, not with a price the frontend sent.
 *
 * Fetches its own PricingContext, so it stays a simple one-shot call for
 * the (non-loop) call sites that price exactly one window — reservation
 * creation, manual admin bookings. For pricing many windows at once, use
 * getPricingContext() + computePriceFromContext() directly instead.
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

  const context = await getPricingContext({
    clubId,
    sportId,
    dateKey: startParts.dateKey,
    dayOfWeek: startParts.dayOfWeek,
  });

  return computePriceFromContext(
    { courtTypeId, startMinutes: startParts.minutesSinceMidnight, durationMinutes, fallbackPricePerHourCents, currency },
    context
  );
}
