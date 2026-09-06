import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

import { expireStalePendingReservations } from "@/lib/availability";

/** Constant-time comparison so a forged token can't be recovered byte-by-byte via response timing. */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Global backstop sweep for stale PENDING_PAYMENT holds. The read-path
 * already expires reservations lazily (see src/lib/availability.ts), so
 * this exists mainly to clean up holds nobody ever queries again (e.g. an
 * abandoned checkout for a court no one else searches for). Wired up to
 * Vercel Cron via vercel.json — Vercel invokes cron endpoints with GET and
 * auto-attaches `Authorization: Bearer $CRON_SECRET`. POST is kept too for
 * any other scheduler that can send a custom header.
 */
async function handleExpireSweep(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no está configurada." }, { status: 500 });
  }
  const provided = request.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!tokenMatches(provided, secret)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  await expireStalePendingReservations();
  return NextResponse.json({ ok: true });
}

export const GET = handleExpireSweep;
export const POST = handleExpireSweep;
