"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDuration, formatMoney } from "@/lib/utils";

interface ReservationSummary {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  totalCents: number;
  currency: string;
  court: { name: string };
  sport: { name: string };
}

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_MS = 45_000;

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ConfirmationView({ initialReservation }: { initialReservation: ReservationSummary }) {
  const [reservation, setReservation] = useState(initialReservation);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (reservation.status !== "PENDING_PAYMENT") return;

    const interval = setInterval(async () => {
      setElapsed((e) => e + POLL_INTERVAL_MS);
      try {
        const res = await fetch(`/api/reservations/${reservation.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setReservation(data.reservation);
      } catch {
        // ignore transient network errors, keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [reservation.id, reservation.status]);

  const durationMinutes = Math.round(
    (new Date(reservation.endsAt).getTime() - new Date(reservation.startsAt).getTime()) / 60_000
  );

  if (reservation.status === "CONFIRMED") {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">¡Reserva confirmada!</h1>
        <p className="mt-1 text-muted-foreground">Te esperamos en la pista. Hemos enviado la confirmación a tu email.</p>

        <Card className="mt-6 text-left">
          <CardHeader>
            <CardTitle>
              {reservation.sport.name} · {reservation.court.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha y hora</span>
              <span className="capitalize">{formatDateTime(reservation.startsAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duración</span>
              <span>{formatDuration(durationMinutes)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <span>Total pagado</span>
              <span>{formatMoney(reservation.totalCents, reservation.currency)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/">Reservar otra pista</Link>
          </Button>
          <Button asChild variant="accent">
            <Link href="/dashboard">Ir a mi panel</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (reservation.status === "PENDING_PAYMENT" && elapsed < MAX_POLL_MS) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
        <h1 className="mt-4 text-xl font-semibold">Confirmando tu pago…</h1>
        <p className="mt-1 text-muted-foreground">Esto solo tomará unos segundos.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <XCircle className="mx-auto h-12 w-12 text-destructive" />
      <h1 className="mt-4 text-xl font-semibold">No hemos podido confirmar el pago</h1>
      <p className="mt-1 text-muted-foreground">
        Si se te ha cobrado, recibirás un reembolso automático. Vuelve a intentarlo cuando quieras.
      </p>
      <Button asChild className="mt-6" variant="accent">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
