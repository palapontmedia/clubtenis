import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUserOrRedirect } from "@/lib/auth-guards";
import { createPaymentIntentForReservation } from "@/lib/payments";
import { formatDuration, formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckoutForm } from "@/components/booking/checkout-form";
import { HoldCountdown } from "@/components/booking/hold-countdown";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserOrRedirect(`/booking/${id}`);

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { court: { include: { courtType: true } }, sport: true, club: true },
  });

  if (!reservation || reservation.createdById !== user.id) notFound();

  if (reservation.status === "CONFIRMED") {
    redirect(`/booking/${id}/confirmation`);
  }
  if (reservation.status !== "PENDING_PAYMENT") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Esta reserva ya no está disponible</h1>
        <p className="mt-2 text-muted-foreground">
          La franja horaria ha expirado o ha sido cancelada. Vuelve a buscar pista.
        </p>
      </div>
    );
  }
  if (reservation.expiresAt && reservation.expiresAt < new Date()) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">La reserva ha expirado</h1>
        <p className="mt-2 text-muted-foreground">El tiempo para completar el pago ha finalizado.</p>
      </div>
    );
  }

  const durationMinutes = Math.round((reservation.endsAt.getTime() - reservation.startsAt.getTime()) / 60_000);

  let clientSecret: string | null = null;
  try {
    const result = await createPaymentIntentForReservation(id, user.id);
    clientSecret = result.clientSecret;
  } catch (error) {
    // Stripe being unreachable/misconfigured must never crash the booking
    // page — the hold is already in place, so show a retryable error
    // instead of an unhandled exception.
    console.error("Failed to create PaymentIntent:", error);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Confirma tu reserva</h1>
      {reservation.expiresAt && <div className="mt-2"><HoldCountdown expiresAt={reservation.expiresAt.toISOString()} /></div>}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{reservation.sport.name} · {reservation.court.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fecha y hora</span>
            <span className="text-right capitalize">{formatDateTime(reservation.startsAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duración</span>
            <span>{formatDuration(durationMinutes)}</span>
          </div>
          {reservation.discountCents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descuento</span>
              <span>-{formatMoney(reservation.discountCents, reservation.currency)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatMoney(reservation.totalCents, reservation.currency)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        {clientSecret ? (
          <CheckoutForm clientSecret={clientSecret} reservationId={id} />
        ) : (
          <Card className="border-destructive/30 bg-destructive/5 p-4 text-center">
            <p className="text-sm text-destructive">
              No se ha podido iniciar el pago. Tu pista sigue reservada temporalmente.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={`/booking/${id}`}>Reintentar</Link>
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
