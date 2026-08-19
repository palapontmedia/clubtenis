import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { getDefaultClub } from "@/lib/club";
import { formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ManualReservationDialog } from "@/components/admin/manual-reservation-dialog";
import { ReservationRowActions } from "@/components/admin/reservation-row-actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "muted" | "destructive" }> = {
  PENDING_PAYMENT: { label: "Pendiente de pago", variant: "warning" },
  CONFIRMED: { label: "Confirmada", variant: "success" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
  COMPLETED: { label: "Completada", variant: "muted" },
  EXPIRED: { label: "Expirada", variant: "muted" },
  NO_SHOW: { label: "No presentado", variant: "destructive" },
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default async function AdminReservationsPage() {
  await requireRole("STAFF");
  const club = await getDefaultClub();
  // This is a Server Component: it runs fresh per request, so reading the
  // current time here is not the render-purity hazard the lint rule
  // assumes for client components.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 24 * 3_600_000);

  const [reservations, courts, players] = await Promise.all([
    prisma.reservation.findMany({
      where: { clubId: club.id, startsAt: { gte: since } },
      include: { court: true, sport: true, createdBy: { select: { name: true, email: true } } },
      orderBy: { startsAt: "asc" },
      take: 100,
    }),
    prisma.court.findMany({ where: { clubId: club.id, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.user.findMany({ where: { role: "PLAYER" }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reservas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Próximas 100 reservas del club.</p>
        </div>
        <ManualReservationDialog clubId={club.id} courts={courts} players={players} />
      </div>

      <div className="mt-6 space-y-2">
        {reservations.map((r) => {
          const status = STATUS_LABEL[r.status] ?? { label: r.status, variant: "muted" as const };
          return (
            <Card key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {r.sport.name} · {r.court.name}
                  </p>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDateTime(r.startsAt)} · {r.createdBy.name} ({r.createdBy.email}) ·{" "}
                  {formatMoney(r.totalCents, r.currency)}
                </p>
              </div>
              <ReservationRowActions id={r.id} status={r.status} />
            </Card>
          );
        })}
        {reservations.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">No hay reservas para mostrar.</Card>
        )}
      </div>
    </div>
  );
}
