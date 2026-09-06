import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ReservationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createReservationSchema } from "@/lib/validation/reservations";
import { createPendingReservation } from "@/lib/reservations";
import { zonedTimeToUtc } from "@/lib/timezone";
import { createTestClub, createTestUser, nextWeekdayDateKey } from "./helpers/fixtures";

const ROLE_RANK = { PLAYER: 0, STAFF: 1, ADMIN: 2, SUPER_ADMIN: 3 } as const;
const currentUser: { value: { id: string; role: keyof typeof ROLE_RANK } } = {
  value: { id: "", role: "PLAYER" },
};

vi.mock("@/lib/auth-guards", () => ({
  requireUser: vi.fn(async () => currentUser.value),
  hasRole: (role: keyof typeof ROLE_RANK, min: keyof typeof ROLE_RANK) =>
    ROLE_RANK[role] >= ROLE_RANK[min],
}));

import { GET as getReservation } from "@/app/api/reservations/[id]/route";

describe("SEC-D2 — participants / reservation IDOR", () => {
  let fixture: Awaited<ReturnType<typeof createTestClub>>;
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let stranger: Awaited<ReturnType<typeof createTestUser>>;
  let staff: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    fixture = await createTestClub();
    owner = await createTestUser();
    stranger = await createTestUser();
    staff = await createTestUser({ role: "STAFF" });
  });

  afterEach(async () => {
    await prisma.reservation.deleteMany({ where: { courtId: fixture.court.id } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, stranger.id, staff.id] } } });
    await prisma.club.delete({ where: { id: fixture.club.id } });
  });

  async function makeOwnerReservation() {
    const dateKey = nextWeekdayDateKey();
    return createPendingReservation({
      createdById: owner.id,
      clubId: fixture.club.id,
      courtId: fixture.court.id,
      startsAt: zonedTimeToUtc(dateKey, "12:00", fixture.club.timezone),
      endsAt: zonedTimeToUtc(dateKey, "13:00", fixture.club.timezone),
    });
  }

  it("createReservationSchema no longer accepts client-supplied participantUserIds", () => {
    const parsed = createReservationSchema.parse({
      clubId: "club1",
      courtId: "court1",
      startsAt: "2026-09-01T10:00:00.000Z",
      durationMinutes: 60,
      participantUserIds: [stranger.id, "someone-else"],
    });
    expect(parsed).not.toHaveProperty("participantUserIds");
  });

  it("a created reservation has exactly one participant — the creator", async () => {
    const reservation = await makeOwnerReservation();
    const participants = await prisma.reservationParticipant.findMany({
      where: { reservationId: reservation.id },
    });
    expect(participants).toHaveLength(1);
    expect(participants[0].userId).toBe(owner.id);
  });

  it("GET /api/reservations/[id] forbids a user who is neither owner, participant nor staff", async () => {
    const reservation = await makeOwnerReservation();
    currentUser.value = { id: stranger.id, role: "PLAYER" };

    const res = await getReservation(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: reservation.id }),
    });
    expect(res.status).toBe(403);
  });

  it("GET /api/reservations/[id] allows the owner and any staff member", async () => {
    const reservation = await makeOwnerReservation();

    currentUser.value = { id: owner.id, role: "PLAYER" };
    const ownerRes = await getReservation(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: reservation.id }),
    });
    expect(ownerRes.status).toBe(200);

    currentUser.value = { id: staff.id, role: "STAFF" };
    const staffRes = await getReservation(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: reservation.id }),
    });
    expect(staffRes.status).toBe(200);
  });

  it("GET /api/reservations/[id] with an unknown id is 404, not a leak", async () => {
    currentUser.value = { id: stranger.id, role: "PLAYER" };
    const res = await getReservation(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: "does-not-exist" }),
    });
    expect(res.status).toBe(404);
  });

  it("keeps a legitimate booking flow working (owner creates and reads back)", async () => {
    const reservation = await makeOwnerReservation();
    expect(reservation.status).toBe(ReservationStatus.PENDING_PAYMENT);

    currentUser.value = { id: owner.id, role: "PLAYER" };
    const res = await getReservation(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: reservation.id }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reservation.id).toBe(reservation.id);
    expect(body.reservation.createdById).toBe(owner.id);
  });
});
