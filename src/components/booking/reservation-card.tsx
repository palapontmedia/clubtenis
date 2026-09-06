"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDuration, formatMoney } from "@/lib/utils";

export interface ReservationCardData {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  totalCents: number;
  currency: string;
  court: { name: string };
  sport: { name: string; icon?: string | null };
  participants: { user: { id: string; name: string } | null; guestName: string | null }[];
}

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "muted" | "destructive" | "default" }> = {
  PENDING_PAYMENT: { label: "Pendiente de pago", variant: "warning" },
  CONFIRMED: { label: "Confirmada", variant: "success" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
  COMPLETED: { label: "Completada", variant: "muted" },
  EXPIRED: { label: "Expirada", variant: "muted" },
  NO_SHOW: { label: "No presentado", variant: "destructive" },
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ReservationCard({ reservation }: { reservation: ReservationCardData }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [open, setOpen] = useState(false);

  const status = STATUS_LABEL[reservation.status] ?? { label: reservation.status, variant: "muted" as const };
  const durationMinutes = Math.round(
    (new Date(reservation.endsAt).getTime() - new Date(reservation.startsAt).getTime()) / 60_000
  );
  const canCancel = reservation.status === "PENDING_PAYMENT" || reservation.status === "CONFIRMED";

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se ha podido cancelar la reserva.");
        return;
      }
      toast.success(
        data.refundCents > 0
          ? `Reserva cancelada. Reembolso: ${formatMoney(data.refundCents, reservation.currency)}`
          : "Reserva cancelada."
      );
      setOpen(false);
      router.refresh();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium">
              {reservation.sport.icon} {reservation.sport.name} · {reservation.court.name}
            </p>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground capitalize">{formatDateTime(reservation.startsAt)}</p>
          <p className="text-sm text-muted-foreground">
            {formatDuration(durationMinutes)} · {formatMoney(reservation.totalCents, reservation.currency)}
          </p>
          {reservation.participants.length > 1 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Con {reservation.participants.length - 1} jugador{reservation.participants.length > 2 ? "es" : ""} más
            </p>
          )}
        </div>

        {canCancel && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Cancelar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display text-xl font-normal">¿Cancelar esta reserva?</DialogTitle>
                <DialogDescription>
                  El reembolso dependerá de la política de cancelación del club según la antelación.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={cancelling}>
                  Volver
                </Button>
                <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
                  {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sí, cancelar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
