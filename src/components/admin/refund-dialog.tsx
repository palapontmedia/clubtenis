"use client";

import { useState } from "react";

import { manualRefund } from "@/lib/actions/payments-admin";
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

export function RefundDialog({ paymentId, maxEuros }: { paymentId: string; maxEuros: number }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function action(formData: FormData) {
    setError(null);
    try {
      await manualRefund(formData);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido reembolsar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Reembolsar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reembolsar pago</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="paymentId" value={paymentId} />
          <div className="grid gap-2">
            <Label htmlFor="amountEuros">Importe (€, máx. {maxEuros.toFixed(2)})</Label>
            <Input id="amountEuros" name="amountEuros" type="number" min={0.01} max={maxEuros} step="0.01" defaultValue={maxEuros.toFixed(2)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reason">Motivo</Label>
            <Input id="reason" name="reason" placeholder="Incidencia en pista, gesto comercial…" required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" variant="destructive">
              Confirmar reembolso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
