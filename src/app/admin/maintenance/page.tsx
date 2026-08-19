import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { getDefaultClub } from "@/lib/club";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClosureDialog } from "@/components/admin/closure-dialog";
import { deleteClosure } from "@/lib/actions/maintenance";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { MAINTENANCE: "Mantenimiento", HOLIDAY: "Festivo", EVENT: "Evento", OTHER: "Otro" };

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default async function AdminMaintenancePage() {
  await requireRole("STAFF");
  const club = await getDefaultClub();

  const [closures, courts] = await Promise.all([
    prisma.courtClosure.findMany({
      where: { court: { clubId: club.id }, endsAt: { gte: new Date() } },
      include: { court: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.court.findMany({ where: { clubId: club.id, active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mantenimiento</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bloqueos de pistas por mantenimiento, eventos o festivos.</p>
        </div>
        <ClosureDialog courts={courts} />
      </div>

      <div className="mt-6 space-y-3">
        {closures.map((closure) => (
          <Card key={closure.id} className="flex items-center justify-between gap-3 p-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{closure.court.name}</p>
                <Badge variant="warning">{KIND_LABEL[closure.kind]}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDateTime(closure.startsAt)} — {formatDateTime(closure.endsAt)}
                {closure.reason ? ` · ${closure.reason}` : ""}
              </p>
            </div>
            <form action={deleteClosure}>
              <input type="hidden" name="id" value={closure.id} />
              <Button type="submit" variant="outline" size="sm">
                Eliminar
              </Button>
            </form>
          </Card>
        ))}
        {closures.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">No hay bloqueos programados.</Card>
        )}
      </div>
    </div>
  );
}
