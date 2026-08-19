"use client";

import { Trash2 } from "lucide-react";

import { deletePricingRule } from "@/lib/actions/pricing";
import { Button } from "@/components/ui/button";

export function DeletePricingRuleButton({ id }: { id: string }) {
  return (
    <form
      action={deletePricingRule}
      onSubmit={(e) => {
        if (!confirm("¿Eliminar esta tarifa?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="icon" aria-label="Eliminar tarifa">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </form>
  );
}
