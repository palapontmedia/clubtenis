import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { isSessionStillValid } from "@/lib/session-validity";
import { createTestUser } from "./helpers/fixtures";

// updateUserRole is a Server Action: stub only its framework edges
// (role guard + cache revalidation), everything else runs for real.
const adminId = { current: "" };
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth-guards", () => ({
  requireRole: vi.fn(async () => ({ id: adminId.current, role: "SUPER_ADMIN" })),
}));

import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { updateUserRole } from "@/lib/actions/users";

describe("SEC-D1 — session revocation cutoff", () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    user = await createTestUser();
    admin = await createTestUser({ role: "SUPER_ADMIN" });
    adminId.current = admin.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: [admin.id] } } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: { in: [user.id, admin.id] } } });
  });

  it("a password reset stamps sessionsValidFrom and invalidates prior sessions", async () => {
    const rawToken = `tok_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 600_000) },
    });

    const beforeReset = Date.now();
    const res = await resetPassword(
      new NextRequest("http://localhost/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: rawToken, password: "BrandNewPass1" }),
      })
    );
    expect(res.status).toBe(200);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.sessionsValidFrom).not.toBeNull();
    expect(after.sessionsValidFrom!.getTime()).toBeGreaterThanOrEqual(beforeReset - 1000);

    // A JWT minted before the reset is now rejected; a fresh login is fine.
    expect(isSessionStillValid(beforeReset - 10_000, after.sessionsValidFrom)).toBe(false);
    expect(isSessionStillValid(Date.now() + 1000, after.sessionsValidFrom)).toBe(true);
  });

  it("a role change stamps sessionsValidFrom on the target user", async () => {
    const target = await createTestUser({ role: "STAFF" });
    try {
      const before = Date.now();
      const fd = new FormData();
      fd.set("userId", target.id);
      fd.set("role", "PLAYER"); // degrade
      await updateUserRole(fd);

      const after = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
      expect(after.role).toBe("PLAYER");
      expect(after.sessionsValidFrom).not.toBeNull();
      expect(after.sessionsValidFrom!.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(isSessionStillValid(before - 10_000, after.sessionsValidFrom)).toBe(false);
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityId: target.id } });
      await prisma.user.delete({ where: { id: target.id } });
    }
  });

  it("leaves an untouched user with no cutoff (normal sessions unaffected)", async () => {
    const fresh = await createTestUser();
    try {
      const row = await prisma.user.findUniqueOrThrow({ where: { id: fresh.id } });
      expect(row.sessionsValidFrom).toBeNull();
      expect(isSessionStillValid(0, row.sessionsValidFrom)).toBe(true);
    } finally {
      await prisma.user.delete({ where: { id: fresh.id } });
    }
  });
});
