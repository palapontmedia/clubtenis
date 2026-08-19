"use client";

import { useState } from "react";

import { adminCancelReservation, markNoShow } from "@/lib/actions/reservations-admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ReservationRowActions({ id, status }: { id: string; status: string }) {
  const [cancelOpen, setCancelOpen] = useState(false);

  const canCancel = status === "PENDING_PAYMENT" || status === "CONFIRMED";
  const canMarkNoShow = status === "CONFIRMED";

  return (
    <div className="flex gap-2">
      {canMarkNoShow && (
        <form action={markNoShow}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="outline" size="sm">
            No presentado
          </Button>
        </form>
      )}
      {canCancel && (
        <>
          <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
            Cancelar
          </Button>
          <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancelar reserva</DialogTitle>
              </DialogHeader>
              <form action={adminCancelReservation} className="space-y-4">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="reason" value="Cancelada por el club" />
                <p className="text-sm text-muted-foreground">
                  Se aplicará la política de reembolso del club automáticamente si corresponde.
                </p>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
                    Volver
                  </Button>
                  <Button type="submit" variant="destructive" onClick={() => setCancelOpen(false)}>
                    Confirmar cancelación
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
