import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { toErrorResponse } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const clubId = request.nextUrl.searchParams.get("clubId");
    const sportId = request.nextUrl.searchParams.get("sportId");
    if (!clubId) {
      return NextResponse.json({ error: "clubId es obligatorio." }, { status: 422 });
    }

    const courts = await prisma.court.findMany({
      where: { clubId, active: true, ...(sportId ? { sportId } : {}) },
      include: { courtType: true, sport: true },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ courts });
  } catch (error) {
    return toErrorResponse(error);
  }
}
