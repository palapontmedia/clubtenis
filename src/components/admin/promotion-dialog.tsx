"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { createPromotion } from "@/lib/actions/promotions";
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

export function PromotionDialog({ clubId, sports }: { clubId: string; sports: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [error, setError] = useState<string | null>(null);

  async function action(formData: FormData) {
    setError(null);
    try {
      await createPromotion(formData);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido crear la promoción.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent" size="sm">
          <Plus className="h-4 w-4" /> Nueva promoción
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva promoción</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="clubId" value={clubId} />

          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" placeholder="Bienvenida de verano" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="discountType">Tipo de descuento</Label>
              <Select name="discountType" value={discountType} onValueChange={setDiscountType}>
                <SelectTrigger id="discountType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Porcentaje</SelectItem>
                  <SelectItem value="FIXED">Importe fijo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="discountValue">{discountType === "PERCENTAGE" ? "% de descuento" : "€ de descuento"}</Label>
              <Input id="discountValue" name="discountValue" type="number" min={0.01} step="0.01" required />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sportId">Deporte (opcional)</Label>
            <Select name="sportId">
              <SelectTrigger id="sportId">
                <SelectValue placeholder="Todos los deportes" />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="startsAt">Desde</Label>
              <Input id="startsAt" name="startsAt" type="date" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endsAt">Hasta</Label>
              <Input id="endsAt" name="endsAt" type="date" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="code">Código promocional</Label>
              <Input id="code" name="code" placeholder="VERANO10" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxRedemptions">Usos máximos</Label>
              <Input id="maxRedemptions" name="maxRedemptions" type="number" min={1} placeholder="Sin límite" />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" variant="accent">
              Crear promoción
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
