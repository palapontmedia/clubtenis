"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

interface HourOption {
  /** ISO instant, doubles as the value submitted to /search. */
  startsAt: string;
  label: string;
}

function todayDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function SearchForm({
  sports,
  clubId,
  timezone,
}: {
  sports: SportOption[];
  clubId: string;
  timezone: string;
}) {
  const router = useRouter();
  const [sportId, setSportId] = useState(sports[0]?.id ?? "");
  const [date, setDate] = useState(todayDateKey());
  const [duration, setDuration] = useState<number>(90);
  const [selectedHour, setSelectedHour] = useState("");
  const [hourOptions, setHourOptions] = useState<HourOption[]>([]);
  const [hoursLoading, setHoursLoading] = useState(false);
  const [hoursChecked, setHoursChecked] = useState(false);

  // When sport/date/duration change, the previously fetched hours (and any
  // hour the user had picked from them) are stale — drop them synchronously
  // during render rather than in the effect below, so we never flash a hora
  // that no longer applies to the current selection.
  const availabilityKey = `${sportId}|${date}|${duration}`;
  const [committedAvailabilityKey, setCommittedAvailabilityKey] = useState(availabilityKey);
  if (committedAvailabilityKey !== availabilityKey) {
    setCommittedAvailabilityKey(availabilityKey);
    setSelectedHour("");
    setHourOptions([]);
    setHoursChecked(false);
  }

  // Reuses the existing /api/availability endpoint (same engine as
  // /search) so start-time filtering never re-implements the
  // opening-hours/reservations/closures/holds logic on the client.
  useEffect(() => {
    if (!sportId || !date || !duration) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ clubId, sportId, date, durationMinutes: String(duration) });

    async function loadHours() {
      setHoursLoading(true);
      try {
        const res = await fetch(`/api/availability?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error("availability request failed");
        const data: { slots: { startsAt: string }[] } = await res.json();

        const seen = new Set<string>();
        const options: HourOption[] = [];
        for (const slot of data.slots) {
          if (seen.has(slot.startsAt)) continue;
          seen.add(slot.startsAt);
          options.push({
            startsAt: slot.startsAt,
            label: new Intl.DateTimeFormat("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: timezone,
            }).format(new Date(slot.startsAt)),
          });
        }
        setHourOptions(options);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setHourOptions([]);
      } finally {
        setHoursLoading(false);
        setHoursChecked(true);
      }
    }

    void loadHours();

    return () => controller.abort();
  }, [sportId, date, duration, clubId, timezone]);

  const hasValidQuery = Boolean(sportId && date && duration);
  const hourPlaceholder = !hasValidQuery
    ? "Selecciona fecha y duración"
    : hoursLoading
      ? "Cargando horas…"
      : hoursChecked && hourOptions.length === 0
        ? "No hay horas disponibles"
        : "Elige una hora";

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedHour) return;
    const params = new URLSearchParams({
      sportId,
      date,
      duration: String(duration),
      startsAt: selectedHour,
    });
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-5 rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8"
    >
      <div className="grid gap-2">
        <Label>¿Qué quieres jugar?</Label>
        <div className="inline-flex flex-wrap gap-1 rounded-full border border-border bg-surface-muted p-1">
          {sports.map((sport) => (
            <button
              type="button"
              key={sport.id}
              onClick={() => setSportId(sport.id)}
              role="tab"
              aria-selected={sportId === sport.id}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
                sportId === sport.id
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:text-foreground"
              )}
            >
              <span aria-hidden>{sport.icon ?? "🎾"}</span>
              {sport.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <Label htmlFor="hour">Hora disponible</Label>
          <Select
            value={selectedHour}
            onValueChange={setSelectedHour}
            disabled={!hasValidQuery || hoursLoading || hourOptions.length === 0}
          >
            <SelectTrigger id="hour" aria-busy={hoursLoading}>
              <SelectValue placeholder={hourPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {hourOptions.map((hour) => (
                <SelectItem key={hour.startsAt} value={hour.startsAt}>
                  {hour.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="sr-only" role="status" aria-live="polite">
            {hoursLoading
              ? "Cargando horas disponibles"
              : hasValidQuery && hoursChecked && hourOptions.length === 0
                ? "No hay horas disponibles"
                : ""}
          </span>
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

      <Button type="submit" size="lg" variant="accent" disabled={!sportId || !selectedHour}>
        Buscar pistas
      </Button>
    </form>
  );
}
