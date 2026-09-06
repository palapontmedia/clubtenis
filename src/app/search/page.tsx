import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getAvailability } from "@/lib/availability";
import { getDefaultClub, getSports } from "@/lib/club";
import { availabilityQuerySchema, createReservationSchema } from "@/lib/validation/reservations";
import { formatDuration, formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import { Eyebrow } from "@/components/ui/typography";
import { AvailabilityLegend } from "@/components/booking/availability-legend";
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

  // A selected hour (from the search form's "Horas disponibles" picker)
  // arrives as a plain query param and is never trusted on its own: it only
  // narrows the results below if it matches an instant that this same,
  // freshly computed availability list actually contains.
  let selectedStartsAt: string | undefined;
  if (typeof params.startsAt === "string") {
    const startsAtCheck = createReservationSchema.shape.startsAt.safeParse(params.startsAt);
    if (!startsAtCheck.success) redirect("/");
    selectedStartsAt = startsAtCheck.data;
  }

  const allSlots = await getAvailability({
    clubId: parsed.data.clubId,
    sportId: parsed.data.sportId,
    dateKey: parsed.data.date,
    durationMinutes: parsed.data.durationMinutes,
  });

  const slots = selectedStartsAt
    ? allSlots.filter((slot) => slot.startsAt.toISOString() === new Date(selectedStartsAt!).toISOString())
    : allSlots;

  const groups = new Map<string, typeof slots>();
  for (const slot of slots) {
    const key = slot.startsAt.toISOString();
    const existing = groups.get(key);
    if (existing) existing.push(slot);
    else groups.set(key, [slot]);
  }

  const referenceDate = new Date(`${parsed.data.date}T12:00:00`);

  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted"
      >
        <ArrowLeft className="h-4 w-4" /> Cambiar búsqueda
      </Link>

      <Eyebrow className="mb-3">Reservas</Eyebrow>
      <h1 className="display-em font-display text-3xl font-normal leading-tight text-foreground sm:text-[38px]">
        Pistas <em>disponibles</em>
      </h1>
      <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
        <span>
          {sport.icon} {sport.name}
        </span>
        <span>·</span>
        <span className="capitalize">{formatDayLabel(referenceDate)}</span>
        <span>·</span>
        <span>{formatDuration(parsed.data.durationMinutes)}</span>
      </div>

      {groups.size > 0 && <AvailabilityLegend className="mt-6" />}

      <div className="mt-8 space-y-8">
        {groups.size === 0 && (
          <Card className="bg-surface-muted p-10 text-center">
            <p className="font-display text-xl">No hay pistas disponibles</p>
            <p className="mt-1 text-sm text-muted-foreground">Prueba con otra hora o fecha.</p>
          </Card>
        )}

        {[...groups.entries()].map(([iso, courtsAtTime]) => (
          <div key={iso}>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              {formatTimeLabel(new Date(iso))}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {courtsAtTime.map((slot) => (
                <Card
                  key={slot.courtId}
                  className="flex items-center justify-between gap-3 bg-surface-muted p-4"
                >
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
                    <p className="mt-2 text-sm font-semibold">
                      {formatMoney(slot.priceCents, slot.currency)}
                    </p>
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
    </Container>
  );
}
