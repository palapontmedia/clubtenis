"use client";

import { toggleCourtActive } from "@/lib/actions/courts";
import { Button } from "@/components/ui/button";

export function ToggleCourtButton({ id, active }: { id: string; active: boolean }) {
  return (
    <form action={toggleCourtActive}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(active)} />
      <Button type="submit" variant="outline" size="sm">
        {active ? "Desactivar" : "Activar"}
      </Button>
    </form>
  );
}
