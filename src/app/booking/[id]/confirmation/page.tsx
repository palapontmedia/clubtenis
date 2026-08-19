import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUserOrRedirect } from "@/lib/auth-guards";
import { ConfirmationView } from "@/components/booking/confirmation-view";

export default async function BookingConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserOrRedirect(`/booking/${id}/confirmation`);

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { court: true, sport: true },
  });

  if (!reservation || reservation.createdById !== user.id) notFound();

  return (
    <ConfirmationView
      initialReservation={{
        id: reservation.id,
        status: reservation.status,
        startsAt: reservation.startsAt.toISOString(),
        endsAt: reservation.endsAt.toISOString(),
        totalCents: reservation.totalCents,
        currency: reservation.currency,
        court: { name: reservation.court.name },
        sport: { name: reservation.sport.name },
      }}
    />
  );
}
