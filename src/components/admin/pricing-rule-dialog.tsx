"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { upsertPricingRule } from "@/lib/actions/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DAY_CATEGORIES = [
  { value: "WEEKDAY", label: "Laborables" },
  { value: "WEEKEND", label: "Fin de semana" },
  { value: "HOLIDAY", label: "Festivos" },
];

interface PricingRuleDialogProps {
  clubId: string;
  sports: { id: string; name: string }[];
  courtTypes: { id: string; name: string }[];
  rule?: {
    id: string;
    name: string;
    sportId: string;
    courtTypeId: string | null;
    dayCategory: string;
    startTime: string;
    endTime: string;
    pricePerHourCents: number;
    priority: number;
  };
}

export function PricingRuleDialog({ clubId, sports, courtTypes, rule }: PricingRuleDialogProps) {
  const [open, setOpen] = useState(false);

  async function action(formData: FormData) {
    await upsertPricingRule(formData);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {rule ? (
          <Button variant="outline" size="sm">
            Editar
          </Button>
        ) : (
          <Button variant="accent" size="sm">
            <Plus className="h-4 w-4" /> Nueva tarifa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? "Editar tarifa" : "Nueva tarifa"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="clubId" value={clubId} />
          {rule && <input type="hidden" name="id" value={rule.id} />}

          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" defaultValue={rule?.name} placeholder="Hora punta tardes" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="sportId">Deporte</Label>
              <Select name="sportId" defaultValue={rule?.sportId ?? sports[0]?.id}>
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
              <Select name="courtTypeId" defaultValue={rule?.courtTypeId ?? undefined}>
                <SelectTrigger id="courtTypeId">
                  <SelectValue placeholder="Todos los tipos" />
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
            <Label htmlFor="dayCategory">Día</Label>
            <Select name="dayCategory" defaultValue={rule?.dayCategory ?? "WEEKDAY"}>
              <SelectTrigger id="dayCategory">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_CATEGORIES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="startTime">Desde</Label>
              <Input id="startTime" name="startTime" type="time" defaultValue={rule?.startTime ?? "08:00"} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endTime">Hasta</Label>
              <Input id="endTime" name="endTime" type="time" defaultValue={rule?.endTime ?? "18:00"} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="pricePerHourEuros">Precio (€/hora)</Label>
              <Input
                id="pricePerHourEuros"
                name="pricePerHourEuros"
                type="number"
                min={0}
                step="0.01"
                defaultValue={rule ? (rule.pricePerHourCents / 100).toFixed(2) : "22.00"}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priority">Prioridad</Label>
              <Input id="priority" name="priority" type="number" min={0} max={100} defaultValue={rule?.priority ?? 1} />
            </div>
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
