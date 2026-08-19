// Wall-clock helpers for interpreting a club's opening hours / pricing
// windows (stored as "HH:mm" + day-of-week, always meant in the club's own
// timezone) against absolute instants (stored as UTC in Postgres).
//
// We deliberately use Intl.DateTimeFormat instead of pulling in a timezone
// library: everything we need is "what wall-clock day/time is this instant
// in timezone X", which Intl already gives us correctly (DST included).

export interface ZonedParts {
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  minutesSinceMidnight: number;
  dateKey: string; // "YYYY-MM-DD" in the target timezone
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = getFormatter(timeZone).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const weekday = WEEKDAY_INDEX[lookup.weekday] ?? 0;
  // Intl can render midnight as "24:00" in some environments; normalize.
  const hour = lookup.hour === "24" ? 0 : Number(lookup.hour);
  const minute = Number(lookup.minute);
  return {
    dayOfWeek: weekday,
    minutesSinceMidnight: hour * 60 + minute,
    dateKey: `${lookup.year}-${lookup.month}-${lookup.day}`,
  };
}

export function timeStringToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Converts a wall-clock date + time in a given IANA timezone to the
 * corresponding absolute instant (UTC). Uses the standard "double
 * conversion" trick: interpret the wall-clock as if it were UTC, check
 * what that instant actually renders as in the target zone, and correct
 * by the difference. Stable for all but the exact DST-transition instant,
 * which is an acceptable trade-off for a booking system.
 */
export function zonedTimeToUtc(dateKey: string, hhmm: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  const zoned = getZonedParts(new Date(guessUtcMs), timeZone);
  const [zYear, zMonth, zDay] = zoned.dateKey.split("-").map(Number);
  const zonedAsUtcMs = Date.UTC(
    zYear,
    zMonth - 1,
    zDay,
    Math.floor(zoned.minutesSinceMidnight / 60),
    zoned.minutesSinceMidnight % 60
  );
  const offsetMs = zonedAsUtcMs - guessUtcMs;
  return new Date(guessUtcMs - offsetMs);
}
