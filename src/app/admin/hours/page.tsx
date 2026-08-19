import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { getDefaultClub } from "@/lib/club";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { OpeningHoursForm } from "@/components/admin/opening-hours-form";
import { createHoliday, deleteHoliday } from "@/lib/actions/schedule";

export const dynamic = "force-dynamic";

export default async function AdminHoursPage() {
  await requireRole("ADMIN");
  const club = await getDefaultClub();

  const [hours, holidays] = await Promise.all([
    prisma.clubOpeningHours.findMany({ where: { clubId: club.id } }),
    prisma.clubHoliday.findMany({ where: { clubId: club.id }, orderBy: { date: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Horarios</h1>
      <p className="mt-1 text-sm text-muted-foreground">Horario de apertura del club y festivos.</p>

      <div className="mt-6">
        <OpeningHoursForm clubId={club.id} hours={hours} />
      </div>

      <Card className="mt-6 p-5">
        <h2 className="mb-3 text-sm font-semibold">Festivos</h2>
        <form action={createHoliday} className="mb-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="clubId" value={club.id} />
          <div className="grid gap-1.5">
            <Label htmlFor="date">Fecha</Label>
            <Input id="date" name="date" type="date" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" placeholder="Navidad" required />
          </div>
          <Button type="submit" variant="accent">
            Añadir festivo
          </Button>
        </form>

        <div className="space-y-2">
          {holidays.map((h) => (
            <div key={h.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span>
                {new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long", year: "numeric" }).format(h.date)} — {h.name}
              </span>
              <form action={deleteHoliday}>
                <input type="hidden" name="id" value={h.id} />
                <Button type="submit" variant="ghost" size="sm">
                  Eliminar
                </Button>
              </form>
            </div>
          ))}
          {holidays.length === 0 && <p className="text-sm text-muted-foreground">No hay festivos configurados.</p>}
        </div>
      </Card>
    </div>
  );
}
