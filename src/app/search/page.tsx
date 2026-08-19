import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getAvailability } from "@/lib/availability";
import { getDefaultClub, getSports } from "@/lib/club";
import { availabilityQuerySchema } from "@/lib/validation/reservations";
import { formatDuration, formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ReserveButton } from "@/components/booking/reserve-button";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function formatTimeLabel(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const [club, sports] = await Promise.all([getDefaultClub(), getSports()]);

  const parsed = availabilityQuerySchema.safeParse({
    clubId: club.id,
    sportId: typeof params.sportId === "string" ? params.sportId : "",
    date: typeof params.date === "string" ? params.date : "",
    durationMinutes: typeof params.duration === "string" ? params.duration : "90",
  });

  if (!parsed.success) {
    redirect("/");
  }

  const sport = sports.find((s) => s.id === parsed.data.sportId);
  if (!sport) redirect("/");

  const slots = await getAvailability({
    clubId: parsed.data.clubId,
    sportId: parsed.data.sportId,
    dateKey: parsed.data.date,
    durationMinutes: parsed.data.durationMinutes,
  });

  const groups = new Map<string, typeof slots>();
  for (const slot of slots) {
    const key = slot.startsAt.toISOString();
    const existing = groups.get(key);
    if (existing) existing.push(slot);
    else groups.set(key, [slot]);
  }

  const referenceDate = new Date(`${parsed.data.date}T12:00:00`);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Cambiar búsqueda
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">Pistas disponibles</h1>
      <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
        <span>
          {sport.icon} {sport.name}
        </span>
        <span>·</span>
        <span className="capitalize">{formatDayLabel(referenceDate)}</span>
        <span>·</span>
        <span>{formatDuration(parsed.data.durationMinutes)}</span>
      </div>

      <div className="mt-8 space-y-6">
        {groups.size === 0 && (
          <Card className="p-8 text-center">
            <p className="font-medium">No hay pistas disponibles</p>
            <p className="mt-1 text-sm text-muted-foreground">Prueba con otra hora o fecha.</p>
          </Card>
        )}

        {[...groups.entries()].map(([iso, courtsAtTime]) => (
          <div key={iso}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{formatTimeLabel(new Date(iso))}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {courtsAtTime.map((slot) => (
                <Card key={slot.courtId} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{slot.courtName}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {slot.courtTypeName && (
                        <Badge variant="outline" className="text-xs">
                          {slot.courtTypeName}
                        </Badge>
                      )}
                      <Badge variant="muted" className="text-xs">
                        {slot.courtIndoor ? "Indoor" : "Outdoor"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold">{formatMoney(slot.priceCents, slot.currency)}</p>
                  </div>
                  <ReserveButton
                    clubId={club.id}
                    courtId={slot.courtId}
                    startsAt={slot.startsAt.toISOString()}
                    durationMinutes={parsed.data.durationMinutes}
                  />
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
