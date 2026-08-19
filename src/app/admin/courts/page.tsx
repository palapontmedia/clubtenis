import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { getDefaultClub } from "@/lib/club";
import { formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourtFormDialog } from "@/components/admin/court-form-dialog";
import { ToggleCourtButton } from "@/components/admin/toggle-court-button";

export const dynamic = "force-dynamic";

export default async function AdminCourtsPage() {
  await requireRole("ADMIN");
  const club = await getDefaultClub();

  const [courts, sports, courtTypes] = await Promise.all([
    prisma.court.findMany({ where: { clubId: club.id }, include: { sport: true, courtType: true }, orderBy: { sortOrder: "asc" } }),
    prisma.sport.findMany({ orderBy: { name: "asc" } }),
    prisma.courtType.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pistas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestiona las pistas del club.</p>
        </div>
        <CourtFormDialog clubId={club.id} sports={sports} courtTypes={courtTypes} />
      </div>

      <div className="mt-6 space-y-3">
        {courts.map((court) => (
          <Card key={court.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{court.name}</p>
                <Badge variant={court.active ? "success" : "muted"}>{court.active ? "Activa" : "Inactiva"}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {court.sport.name} · {court.courtType?.name ?? "Sin tipo"} · {court.indoor ? "Indoor" : "Outdoor"}
                {court.covered ? " · Cubierta" : ""} · {formatMoney(court.basePriceCents, club.currency)}/h base
              </p>
            </div>
            <div className="flex gap-2">
              <CourtFormDialog
                clubId={club.id}
                sports={sports}
                courtTypes={courtTypes}
                court={{
                  id: court.id,
                  name: court.name,
                  sportId: court.sportId,
                  courtTypeId: court.courtTypeId,
                  indoor: court.indoor,
                  covered: court.covered,
                  active: court.active,
                  basePriceCents: court.basePriceCents,
                  description: court.description,
                }}
              />
              <ToggleCourtButton id={court.id} active={court.active} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
