import { NextResponse } from "next/server";

import { requireUser, hasRole } from "@/lib/auth-guards";
import { cancelReservation } from "@/lib/reservations";
import { refundPayment } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { cancelReservationSchema } from "@/lib/validation/reservations";
import { toErrorResponse } from "@/lib/api-error";
import { notify } from "@/lib/notifications";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = cancelReservationSchema.parse(await request.json().catch(() => ({})));

    const isStaff = hasRole(user.role, "STAFF");
    const { refundCents } = await cancelReservation({
      reservationId: id,
      actingUserId: user.id,
      isStaff,
      reason: body.reason,
    });

    if (refundCents > 0) {
      const payment = await prisma.payment.findFirst({
        where: { reservationId: id, status: "SUCCEEDED" },
        orderBy: { createdAt: "desc" },
      });
      if (payment) {
        await refundPayment(payment.id, refundCents, body.reason ?? "Cancelación de reserva");
      }
    }

    const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id } });
    await notify({
      userId: reservation.createdById,
      type: "RESERVATION_CANCELLED",
      reservationId: id,
      title: "Reserva cancelada",
      body:
        refundCents > 0
          ? `Tu reserva ha sido cancelada. Se ha reembolsado ${(refundCents / 100).toFixed(2)} €.`
          : "Tu reserva ha sido cancelada.",
    });

    return NextResponse.json({ reservation, refundCents });
  } catch (error) {
    return toErrorResponse(error);
  }
}
