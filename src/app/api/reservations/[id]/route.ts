import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth-guards";
import { AppError, toErrorResponse } from "@/lib/api-error";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        court: { include: { courtType: true } },
        sport: true,
        club: true,
        payments: { orderBy: { createdAt: "desc" } },
        participants: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    if (!reservation) throw new AppError("Reserva no encontrada.", 404, "RESERVATION_NOT_FOUND");

    // IDOR guard: a player can only see their own reservation, regardless
    // of how they got the id (URL guessing, shared link, etc.).
    const isOwner = reservation.createdById === user.id;
    const isParticipant = reservation.participants.some((p) => p.userId === user.id);
    if (!isOwner && !isParticipant && !hasRole(user.role, "STAFF")) {
      throw new AppError("No tienes acceso a esta reserva.", 403, "FORBIDDEN");
    }

    return NextResponse.json({ reservation });
  } catch (error) {
    return toErrorResponse(error);
  }
}
