import { NextRequest, NextResponse } from "next/server";

import { getAvailability } from "@/lib/availability";
import { availabilityQuerySchema } from "@/lib/validation/reservations";
import { toErrorResponse } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
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
