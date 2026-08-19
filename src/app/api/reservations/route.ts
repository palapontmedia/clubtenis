import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { createPendingReservation } from "@/lib/reservations";
import { createReservationSchema } from "@/lib/validation/reservations";
import { toErrorResponse } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const scope = request.nextUrl.searchParams.get("scope") ?? "upcoming";

    const reservations = await prisma.reservation.findMany({
      where: {
        createdById: user.id,
        ...(scope === "upcoming"
          ? { startsAt: { gte: new Date() }, status: { in: ["PENDING_PAYMENT", "CONFIRMED"] } }
          : { OR: [{ startsAt: { lt: new Date() } }, { status: { in: ["CANCELLED", "EXPIRED", "COMPLETED", "NO_SHOW"] } }] }),
      },
      include: {
        court: { include: { courtType: true } },
        sport: true,
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
        participants: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { startsAt: scope === "upcoming" ? "asc" : "desc" },
    });

    return NextResponse.json({ reservations });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = createReservationSchema.parse(await request.json());

    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(startsAt.getTime() + body.durationMinutes * 60_000);

    const reservation = await createPendingReservation({
      createdById: user.id,
      clubId: body.clubId,
      courtId: body.courtId,
      startsAt,
      endsAt,
      promoCode: body.promoCode,
      notes: body.notes,
    });

    if (body.participantUserIds?.length) {
      await prisma.reservationParticipant.createMany({
        data: body.participantUserIds
          .filter((id) => id !== user.id)
          .map((userId) => ({ reservationId: reservation.id, userId })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
