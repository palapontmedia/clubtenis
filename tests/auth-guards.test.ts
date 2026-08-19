import { describe, expect, it } from "vitest";

import { hasRole } from "@/lib/roles";

describe("hasRole", () => {
  it("allows a role to access its own minimum", () => {
    expect(hasRole("STAFF", "STAFF")).toBe(true);
  });

  it("allows a higher role to access a lower minimum", () => {
    expect(hasRole("SUPER_ADMIN", "PLAYER")).toBe(true);
    expect(hasRole("ADMIN", "STAFF")).toBe(true);
  });

  it("denies a lower role access to a higher minimum", () => {
    expect(hasRole("PLAYER", "STAFF")).toBe(false);
    expect(hasRole("STAFF", "ADMIN")).toBe(false);
    expect(hasRole("ADMIN", "SUPER_ADMIN")).toBe(false);
  });

  it("never lets a PLAYER reach admin-only resources", () => {
    expect(hasRole("PLAYER", "ADMIN")).toBe(false);
    expect(hasRole("PLAYER", "SUPER_ADMIN")).toBe(false);
  });
});
