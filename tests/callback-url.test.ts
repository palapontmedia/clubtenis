import { describe, expect, it } from "vitest";

import { resolveInternalRedirect } from "@/lib/callback-url";

describe("resolveInternalRedirect", () => {
  it("accepts a plain internal path", () => {
    expect(resolveInternalRedirect("/dashboard", "/")).toBe("/dashboard");
  });

  it("preserves the exact booking hand-off URL the login/register flow relies on", () => {
    // This is the literal shape ReserveButton builds when an anonymous
    // user clicks "Reservar pista": the login/register detour must return
    // the user to this exact URL, untouched, so nothing has to be
    // re-searched after authenticating.
    const bookingIntent =
      "/booking/new?clubId=club1&courtId=court1&startsAt=2026-09-01T10%3A00%3A00.000Z&durationMinutes=90&back=%2Fsearch%3FsportId%3Dpadel%26date%3D2026-09-01%26duration%3D90";
    expect(resolveInternalRedirect(bookingIntent, "/dashboard")).toBe(bookingIntent);
  });

  it("rejects an absolute external URL", () => {
    expect(resolveInternalRedirect("https://evil.example/phish", "/dashboard")).toBe("/dashboard");
  });

  it("rejects a protocol-relative URL (the classic //host open-redirect bypass)", () => {
    expect(resolveInternalRedirect("//evil.example", "/dashboard")).toBe("/dashboard");
  });

  it("rejects a javascript: pseudo-protocol value", () => {
    expect(resolveInternalRedirect("javascript:alert(1)", "/dashboard")).toBe("/dashboard");
  });

  it("rejects a path that doesn't start with a slash", () => {
    expect(resolveInternalRedirect("evil.example", "/dashboard")).toBe("/dashboard");
  });

  it("falls back when the value is missing", () => {
    expect(resolveInternalRedirect(null, "/dashboard")).toBe("/dashboard");
    expect(resolveInternalRedirect(undefined, "/dashboard")).toBe("/dashboard");
    expect(resolveInternalRedirect("", "/dashboard")).toBe("/dashboard");
  });
});
