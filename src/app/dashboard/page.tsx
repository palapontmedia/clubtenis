import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireUserOrRedirect } from "@/lib/auth-guards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReservationCard } from "@/components/booking/reservation-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUserOrRedirect("/dashboard");

  const [nextReservations, recentHistory] = await Promise.all([
    prisma.reservation.findMany({
      where: { createdById: user.id, status: { in: ["PENDING_PAYMENT", "CONFIRMED"] }, startsAt: { gte: new Date() } },
      include: { court: true, sport: true, participants: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: { startsAt: "asc" },
      take: 3,
    }),
    prisma.reservation.findMany({
      where: { createdById: user.id, OR: [{ startsAt: { lt: new Date() } }, { status: { in: ["CANCELLED", "EXPIRED"] } }] },
      include: { court: true, sport: true, participants: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: { startsAt: "desc" },
      take: 3,
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Hola, {user.name?.split(" ")[0] ?? "jugador"}</h1>
        <Button asChild variant="accent">
          <Link href="/">Reservar pista</Link>
        </Button>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Próximas reservas
        </h2>
        {nextReservations.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No tienes reservas próximas.{" "}
            <Link href="/" className="font-medium text-foreground hover:underline">
              Reserva una pista
            </Link>
            .
          </Card>
        ) : (
          <div className="space-y-3">
            {nextReservations.map((r) => (
              <ReservationCard
                key={r.id}
                reservation={{
                  id: r.id,
                  status: r.status,
                  startsAt: r.startsAt.toISOString(),
                  endsAt: r.endsAt.toISOString(),
                  totalCents: r.totalCents,
                  currency: r.currency,
                  court: { name: r.court.name },
                  sport: { name: r.sport.name, icon: r.sport.icon },
                  participants: r.participants.map((p) => ({ user: p.user, guestName: p.guestName })),
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Historial reciente</h2>
          <Link href="/reservations" className="text-sm font-medium text-foreground hover:underline">
            Ver todo
          </Link>
        </div>
        {recentHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no tienes reservas anteriores.</p>
        ) : (
          <div className="space-y-3">
            {recentHistory.map((r) => (
              <ReservationCard
                key={r.id}
                reservation={{
                  id: r.id,
                  status: r.status,
                  startsAt: r.startsAt.toISOString(),
                  endsAt: r.endsAt.toISOString(),
                  totalCents: r.totalCents,
                  currency: r.currency,
                  court: { name: r.court.name },
                  sport: { name: r.sport.name, icon: r.sport.icon },
                  participants: r.participants.map((p) => ({ user: p.user, guestName: p.guestName })),
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
