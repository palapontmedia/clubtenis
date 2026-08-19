import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { getDefaultClub } from "@/lib/club";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateClubInfo, updateCancellationPolicy } from "@/lib/actions/settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireRole("ADMIN");
  const club = await getDefaultClub();

  const policy = await prisma.cancellationPolicy.findFirst({
    where: { clubId: club.id, isDefault: true },
    include: { tiers: { orderBy: { minHoursBefore: "desc" } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">Datos del club y política de cancelación.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del club</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateClubInfo} className="space-y-4">
            <input type="hidden" name="clubId" value={club.id} />
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" defaultValue={club.name} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={club.description ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" name="address" defaultValue={club.address ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" name="phone" defaultValue={club.phone ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={club.email ?? ""} />
              </div>
            </div>
            <Button type="submit" variant="accent">
              Guardar datos del club
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Política de cancelación</CardTitle>
        </CardHeader>
        <CardContent>
          {policy ? (
            <form action={updateCancellationPolicy} className="space-y-3">
              <input type="hidden" name="clubId" value={club.id} />
              <input type="hidden" name="policyId" value={policy.id} />
              <div className="grid grid-cols-2 gap-3 text-xs font-medium text-muted-foreground">
                <span>Horas de antelación mínima</span>
                <span>% de reembolso</span>
              </div>
              {policy.tiers.map((tier) => (
                <div key={tier.id} className="grid grid-cols-2 gap-3">
                  <Input type="number" name="minHoursBefore" min={0} defaultValue={tier.minHoursBefore} required />
                  <Input type="number" name="refundPercentage" min={0} max={100} defaultValue={tier.refundPercentage} required />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Ejemplo: 24h → 100%, 12h → 50%, 0h → 0%. Se aplica el nivel más alto que la reserva todavía cumple.
              </p>
              <Button type="submit" variant="accent">
                Guardar política
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">No hay política de cancelación configurada.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
