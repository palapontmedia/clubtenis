"use client";

import { useState } from "react";
import { toast } from "sonner";

import { updateOpeningHours } from "@/lib/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface OpeningHoursFormProps {
  clubId: string;
  hours: { dayOfWeek: number; opensAt: string; closesAt: string; closed: boolean }[];
}

export function OpeningHoursForm({ clubId, hours }: OpeningHoursFormProps) {
  const [submitting, setSubmitting] = useState(false);

  async function action(formData: FormData) {
    setSubmitting(true);
    try {
      await updateOpeningHours(formData);
      toast.success("Horarios actualizados.");
    } catch {
      toast.error("No se han podido guardar los horarios.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-5">
      <form action={action} className="space-y-3">
        <input type="hidden" name="clubId" value={clubId} />
        {DAY_NAMES.map((name, day) => {
          const dayHours = hours.find((h) => h.dayOfWeek === day);
          return (
            <div key={day} className="flex flex-wrap items-center gap-3 border-b border-border pb-3 last:border-b-0">
              <span className="w-24 text-sm font-medium">{name}</span>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox name={`closed-${day}`} value="true" defaultChecked={dayHours?.closed} /> Cerrado
              </label>
              <Input type="time" name={`opensAt-${day}`} defaultValue={dayHours?.opensAt ?? "08:00"} className="w-32" />
              <span className="text-muted-foreground">a</span>
              <Input type="time" name={`closesAt-${day}`} defaultValue={dayHours?.closesAt ?? "22:00"} className="w-32" />
            </div>
          );
        })}
        <Button type="submit" variant="accent" disabled={submitting}>
          Guardar horarios
        </Button>
      </form>
    </Card>
  );
}
