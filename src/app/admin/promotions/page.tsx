import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { getDefaultClub } from "@/lib/club";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PromotionDialog } from "@/components/admin/promotion-dialog";
import { togglePromotionActive } from "@/lib/actions/promotions";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export default async function AdminPromotionsPage() {
  await requireRole("ADMIN");
  const club = await getDefaultClub();

  const [promotions, sports] = await Promise.all([
    prisma.promotion.findMany({
      where: { clubId: club.id },
      include: { promoCodes: true, sport: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sport.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Promociones</h1>
          <p className="mt-1 text-sm text-muted-foreground">Descuentos y códigos promocionales.</p>
        </div>
        <PromotionDialog clubId={club.id} sports={sports} />
      </div>

      <div className="mt-6 space-y-3">
        {promotions.map((promo) => (
          <Card key={promo.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{promo.name}</p>
                <Badge variant={promo.active ? "success" : "muted"}>{promo.active ? "Activa" : "Inactiva"}</Badge>
                {promo.sport && <Badge variant="outline">{promo.sport.name}</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {promo.discountType === "PERCENTAGE" ? `${promo.discountValue}%` : `${(promo.discountValue / 100).toFixed(2)} €`} de
                descuento · {formatDate(promo.startsAt)} – {formatDate(promo.endsAt)}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {promo.promoCodes.map((c) => (
                  <Badge key={c.id} variant="outline">
                    {c.code} ({c.redemptionCount}
                    {c.maxRedemptions ? `/${c.maxRedemptions}` : ""})
                  </Badge>
                ))}
              </div>
            </div>
            <form action={togglePromotionActive}>
              <input type="hidden" name="id" value={promo.id} />
              <input type="hidden" name="active" value={String(promo.active)} />
              <Button type="submit" variant="outline" size="sm">
                {promo.active ? "Desactivar" : "Activar"}
              </Button>
            </form>
          </Card>
        ))}
        {promotions.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">No hay promociones creadas.</Card>
        )}
      </div>
    </div>
  );
}
