"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils";
import { ALLOWED_DURATIONS_MINUTES } from "@/lib/validation/reservations";

interface SportOption {
  id: string;
  name: string;
  icon: string | null;
}

function todayDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function SearchForm({ sports }: { sports: SportOption[] }) {
  const router = useRouter();
  const [sportId, setSportId] = useState(sports[0]?.id ?? "");
  const [date, setDate] = useState(todayDateKey());
  const [duration, setDuration] = useState<number>(90);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams({ sportId, date, duration: String(duration) });
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-5 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
    >
      <div className="grid gap-2">
        <Label>¿Qué quieres jugar?</Label>
        <div className="grid grid-cols-2 gap-2">
          {sports.map((sport) => (
            <button
              type="button"
              key={sport.id}
              onClick={() => setSportId(sport.id)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                sportId === sport.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border-strong bg-transparent text-foreground hover:bg-surface-muted"
              )}
            >
              <span aria-hidden>{sport.icon ?? "🎾"}</span>
              {sport.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="date">Fecha</Label>
          <Input
            id="date"
            type="date"
            value={date}
            min={todayDateKey()}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="duration">Duración</Label>
          <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
            <SelectTrigger id="duration">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALLOWED_DURATIONS_MINUTES.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {formatDuration(minutes)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" size="lg" variant="accent" disabled={!sportId}>
        Buscar pistas
      </Button>
    </form>
  );
}
