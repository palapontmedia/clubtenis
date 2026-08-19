import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardMetrics } from "@/lib/admin/metrics";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const metrics = await getDashboardMetrics();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Resumen operativo del club.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Reservas hoy" value={String(metrics.reservationsToday)} />
        <KpiCard label="Reservas esta semana" value={String(metrics.reservationsThisWeek)} />
        <KpiCard label="Ingresos (semana)" value={formatMoney(metrics.revenueThisWeekCents, metrics.currency)} />
        <KpiCard label="Ocupación hoy" value={`${metrics.occupancyPercent}%`} />
        <KpiCard label="Cancelaciones (semana)" value={String(metrics.cancellationsThisWeek)} />
        <KpiCard label="Pista más usada (30d)" value={metrics.topCourtName} />
        <KpiCard label="Hora punta (30d)" value={metrics.peakHourLabel} />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Accesos rápidos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <a href="/admin/calendar" className="rounded-md border border-border p-3 hover:bg-surface-muted">
            Ver calendario operativo
          </a>
          <a href="/admin/reservations" className="rounded-md border border-border p-3 hover:bg-surface-muted">
            Gestionar reservas
          </a>
          <a href="/admin/maintenance" className="rounded-md border border-border p-3 hover:bg-surface-muted">
            Bloquear una pista por mantenimiento
          </a>
          <a href="/admin/pricing" className="rounded-md border border-border p-3 hover:bg-surface-muted">
            Configurar tarifas
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
