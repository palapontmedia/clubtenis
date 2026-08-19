"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { createClosure } from "@/lib/actions/maintenance";
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

const KINDS = [
  { value: "MAINTENANCE", label: "Mantenimiento" },
  { value: "HOLIDAY", label: "Festivo" },
  { value: "EVENT", label: "Evento" },
  { value: "OTHER", label: "Otro" },
];

export function ClosureDialog({ courts }: { courts: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function action(formData: FormData) {
    setError(null);
    try {
      await createClosure(formData);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido crear el bloqueo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent" size="sm">
          <Plus className="h-4 w-4" /> Bloquear pista
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bloquear pista</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
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

          <div className="grid gap-2">
            <Label htmlFor="kind">Motivo</Label>
            <Select name="kind" defaultValue="MAINTENANCE">
              <SelectTrigger id="kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="startsAt">Desde</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endsAt">Hasta</Label>
              <Input id="endsAt" name="endsAt" type="datetime-local" required />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reason">Descripción</Label>
            <Textarea id="reason" name="reason" rows={2} placeholder="Cambio de césped artificial…" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" variant="accent">
              Bloquear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
