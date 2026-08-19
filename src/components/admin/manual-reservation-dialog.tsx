"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { createManualReservation } from "@/lib/actions/reservations-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ManualReservationDialogProps {
  clubId: string;
  courts: { id: string; name: string }[];
  players: { id: string; name: string; email: string }[];
}

export function ManualReservationDialog({ clubId, courts, players }: ManualReservationDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function action(formData: FormData) {
    setError(null);
    try {
      await createManualReservation(formData);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido crear la reserva.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent" size="sm">
          <Plus className="h-4 w-4" /> Reserva manual
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva reserva manual</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="clubId" value={clubId} />

          <div className="grid gap-2">
            <Label htmlFor="userId">Jugador</Label>
            <Select name="userId">
              <SelectTrigger id="userId">
                <SelectValue placeholder="Selecciona un jugador" />
              </SelectTrigger>
              <SelectContent>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="courtId">Pista</Label>
            <Select name="courtId">
              <SelectTrigger id="courtId">
                <SelectValue placeholder="Selecciona una pista" />
              </SelectTrigger>
              <SelectContent>
                {courts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="startsAt">Fecha y hora</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="durationMinutes">Duración (min)</Label>
              <Input id="durationMinutes" name="durationMinutes" type="number" min={30} step={30} defaultValue={90} required />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" rows={2} placeholder="Reserva telefónica, walk-in…" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" variant="accent">
              Crear reserva
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
