import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { getDefaultClub } from "@/lib/club";
import { formatMoney, cn } from "@/lib/utils";
import { getZonedParts, timeStringToMinutes, zonedTimeToUtc } from "@/lib/timezone";
import { SLOT_STEP_MINUTES } from "@/lib/config";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDateKey(dateKey: string, days: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

interface CalendarPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminCalendarPage({ searchParams }: CalendarPageProps) {
  await requireRole("STAFF");
  const club = await getDefaultClub();
  const params = await searchParams;

  const dateKey = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayKey();

  const courts = await prisma.court.findMany({ where: { clubId: club.id, active: true }, orderBy: { sortOrder: "asc" } });
  const courtId = typeof params.courtId === "string" && courts.some((c) => c.id === params.courtId) ? params.courtId : courts[0]?.id;
  const activeCourt = courts.find((c) => c.id === courtId);

  const dayOfWeek = getZonedParts(zonedTimeToUtc(dateKey, "12:00", club.timezone), club.timezone).dayOfWeek;
  const openingHours = await prisma.clubOpeningHours.findUnique({ where: { clubId_dayOfWeek: { clubId: club.id, dayOfWeek } } });

  let rows: { time: string; kind: "free" | "reservation" | "closure"; label?: string; href?: string }[] = [];

  if (activeCourt && openingHours && !openingHours.closed) {
    const dayStart = zonedTimeToUtc(dateKey, "00:00", club.timezone);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000);

    const [reservations, closures] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          courtId: activeCourt.id,
          status: { in: ["PENDING_PAYMENT", "CONFIRMED", "COMPLETED", "NO_SHOW"] },
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
        include: { createdBy: { select: { name: true } } },
      }),
      prisma.courtClosure.findMany({
        where: { courtId: activeCourt.id, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
      }),
    ]);

    const openMin = timeStringToMinutes(openingHours.opensAt);
    const closeMin = timeStringToMinutes(openingHours.closesAt);

    rows = [];
    for (let minutes = openMin; minutes < closeMin; minutes += SLOT_STEP_MINUTES) {
      const slotStart = zonedTimeToUtc(dateKey, `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`, club.timezone);
      const slotEnd = new Date(slotStart.getTime() + SLOT_STEP_MINUTES * 60_000);

      const reservation = reservations.find((r) => r.startsAt < slotEnd && r.endsAt > slotStart);
      const closure = closures.find((c) => c.startsAt < slotEnd && c.endsAt > slotStart);

      const timeLabel = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

      if (reservation) {
        rows.push({
          time: timeLabel,
          kind: "reservation",
          label: `${reservation.createdBy.name} · ${formatMoney(reservation.totalCents, reservation.currency)} · ${reservation.status}`,
          href: `/admin/reservations`,
        });
      } else if (closure) {
        rows.push({ time: timeLabel, kind: "closure", label: closure.reason ?? closure.kind });
      } else {
        rows.push({ time: timeLabel, kind: "free" });
      }
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
          <p className="mt-1 text-sm text-muted-foreground">Vista operativa diaria por pista.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon">
            <Link href={`/admin/calendar?date=${shiftDateKey(dateKey, -1)}&courtId=${courtId ?? ""}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <span className="text-sm font-medium">{dateKey}</span>
          <Button asChild variant="outline" size="icon">
            <Link href={`/admin/calendar?date=${shiftDateKey(dateKey, 1)}&courtId=${courtId ?? ""}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {courts.map((c) => (
          <Link
            key={c.id}
            href={`/admin/calendar?date=${dateKey}&courtId=${c.id}`}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium",
              c.id === courtId ? "border-primary bg-primary text-primary-foreground" : "border-border-strong hover:bg-surface-muted"
            )}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <Card className="mt-6 divide-y divide-border overflow-hidden">
        {!openingHours || openingHours.closed ? (
          <p className="p-8 text-center text-sm text-muted-foreground">El club está cerrado este día.</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No hay pistas activas.</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.time}
              className={cn(
                "flex items-center gap-3 px-4 py-2 text-sm",
                row.kind === "reservation" && "bg-primary/5",
                row.kind === "closure" && "bg-warning/10"
              )}
            >
              <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{row.time}</span>
              {row.kind === "free" && <span className="text-muted-foreground">—</span>}
              {row.kind === "reservation" && (
                <>
                  <Badge variant="success">Reserva</Badge>
                  <span>{row.label}</span>
                </>
              )}
              {row.kind === "closure" && (
                <>
                  <Badge variant="warning">Bloqueada</Badge>
                  <span>{row.label}</span>
                </>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
