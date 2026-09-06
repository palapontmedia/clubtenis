import { NextRequest, NextResponse } from "next/server";

import { getAvailability } from "@/lib/availability";
import { availabilityQuerySchema } from "@/lib/validation/reservations";
import { toErrorResponse } from "@/lib/api-error";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    // Unauthenticated endpoint that runs several DB queries (and a lazy
    // expiry write) per call. A generous per-IP cap — far above any real
    // search session — blunts scripted hammering without affecting users.
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { success } = rateLimit(`availability:${ip}`, 100, 60_000);
    if (!success) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Prueba de nuevo en unos segundos.", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    const params = availabilityQuerySchema.parse({
      clubId: request.nextUrl.searchParams.get("clubId"),
      sportId: request.nextUrl.searchParams.get("sportId"),
      date: request.nextUrl.searchParams.get("date"),
      durationMinutes: request.nextUrl.searchParams.get("durationMinutes"),
    });

    const slots = await getAvailability({
      clubId: params.clubId,
      sportId: params.sportId,
      dateKey: params.date,
      durationMinutes: params.durationMinutes,
    });

    return NextResponse.json({ slots });
  } catch (error) {
    return toErrorResponse(error);
  }
}
