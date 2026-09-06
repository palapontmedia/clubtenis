import { describe, expect, it } from "vitest";

import { isSessionStillValid } from "@/lib/session-validity";

describe("isSessionStillValid", () => {
  it("accepts any session when the user has no revocation cutoff", () => {
    expect(isSessionStillValid(0, null)).toBe(true);
    expect(isSessionStillValid(Date.now(), undefined)).toBe(true);
  });

  it("keeps a session that was minted at or after the cutoff", () => {
    const cutoff = new Date("2026-01-01T00:00:00.000Z");
    expect(isSessionStillValid(cutoff.getTime(), cutoff)).toBe(true); // boundary: exactly at cutoff
    expect(isSessionStillValid(cutoff.getTime() + 1, cutoff)).toBe(true);
    // A fresh login after a password reset / role change works normally.
    expect(isSessionStillValid(cutoff.getTime() + 60_000, cutoff)).toBe(true);
  });

  it("rejects a session minted before the cutoff", () => {
    const cutoff = new Date("2026-01-01T00:00:00.000Z");
    expect(isSessionStillValid(cutoff.getTime() - 1, cutoff)).toBe(false);
    expect(isSessionStillValid(cutoff.getTime() - 3_600_000, cutoff)).toBe(false);
  });
});
