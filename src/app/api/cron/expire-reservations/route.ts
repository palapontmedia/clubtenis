import { NextRequest, NextResponse } from "next/server";

import { expireStalePendingReservations } from "@/lib/availability";

/**
 * Global backstop sweep for stale PENDING_PAYMENT holds. The read-path
 * already expires reservations lazily (see src/lib/availability.ts), so
 * this exists mainly to clean up holds nobody ever queries again (e.g. an
 * abandoned checkout for a court no one else searches for). Wire this up
 * to a scheduler (Vercel Cron, a system cron hitting this URL, etc.) to
 * run every minute.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no está configurada." }, { status: 500 });
  }
  const provided = request.headers.get("authorization")?.replace("Bearer ", "");
  if (provided !== secret) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  await expireStalePendingReservations();
  return NextResponse.json({ ok: true });
}
