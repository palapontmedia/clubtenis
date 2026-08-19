"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { upsertCourt } from "@/lib/actions/courts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CourtFormDialogProps {
  clubId: string;
  sports: { id: string; name: string }[];
  courtTypes: { id: string; name: string }[];
  court?: {
    id: string;
    name: string;
    sportId: string;
    courtTypeId: string | null;
    indoor: boolean;
    covered: boolean;
    active: boolean;
    basePriceCents: number;
    description: string | null;
  };
}

export function CourtFormDialog({ clubId, sports, courtTypes, court }: CourtFormDialogProps) {
  const [open, setOpen] = useState(false);

  async function action(formData: FormData) {
    await upsertCourt(formData);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {court ? (
          <Button variant="outline" size="sm">
            Editar
          </Button>
        ) : (
          <Button variant="accent" size="sm">
            <Plus className="h-4 w-4" /> Nueva pista
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{court ? "Editar pista" : "Nueva pista"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="clubId" value={clubId} />
          {court && <input type="hidden" name="id" value={court.id} />}

          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" defaultValue={court?.name} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="sportId">Deporte</Label>
              <Select name="sportId" defaultValue={court?.sportId ?? sports[0]?.id}>
                <SelectTrigger id="sportId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sports.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="courtTypeId">Tipo de pista</Label>
              <Select name="courtTypeId" defaultValue={court?.courtTypeId ?? undefined}>
                <SelectTrigger id="courtTypeId">
                  <SelectValue placeholder="Sin tipo" />
                </SelectTrigger>
                <SelectContent>
                  {courtTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="basePriceEuros">Precio base (€/hora)</Label>
            <Input
              id="basePriceEuros"
              name="basePriceEuros"
              type="number"
              min={0}
              step="0.01"
              defaultValue={court ? (court.basePriceCents / 100).toFixed(2) : "20.00"}
              required
            />
            <p className="text-xs text-muted-foreground">
              Se usa cuando ninguna tarifa horaria configurada aplica a la franja.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="indoor" value="true" defaultChecked={court?.indoor} /> Indoor
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="covered" value="true" defaultChecked={court?.covered} /> Cubierta
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="active" value="true" defaultChecked={court?.active ?? true} /> Activa
            </label>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" name="description" rows={2} defaultValue={court?.description ?? ""} />
          </div>

          <DialogFooter>
            <Button type="submit" variant="accent">
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
