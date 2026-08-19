import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { getDefaultClub } from "@/lib/club";
import { formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PricingRuleDialog } from "@/components/admin/pricing-rule-dialog";
import { DeletePricingRuleButton } from "@/components/admin/delete-pricing-rule-button";

export const dynamic = "force-dynamic";

const DAY_LABEL: Record<string, string> = { WEEKDAY: "Laborables", WEEKEND: "Fin de semana", HOLIDAY: "Festivo" };

export default async function AdminPricingPage() {
  await requireRole("ADMIN");
  const club = await getDefaultClub();

  const [rules, sports, courtTypes] = await Promise.all([
    prisma.pricingRule.findMany({
      where: { clubId: club.id },
      include: { sport: true, courtType: true },
      orderBy: [{ sportId: "asc" }, { dayCategory: "asc" }, { startTime: "asc" }],
    }),
    prisma.sport.findMany({ orderBy: { name: "asc" } }),
    prisma.courtType.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Precios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tarifas por deporte, tipo de pista, día y franja horaria. El motor de precios elige la regla más
            específica y prorratea por duración.
          </p>
        </div>
        <PricingRuleDialog clubId={club.id} sports={sports} courtTypes={courtTypes} />
      </div>

      <div className="mt-6 space-y-3">
        {rules.map((rule) => (
          <Card key={rule.id} className="flex items-center justify-between gap-3 p-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{rule.name}</p>
                <Badge variant="outline">{rule.sport.name}</Badge>
                <Badge variant="muted">{DAY_LABEL[rule.dayCategory]}</Badge>
                {rule.courtType && <Badge variant="outline">{rule.courtType.name}</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {rule.startTime}–{rule.endTime} · {formatMoney(rule.pricePerHourCents, club.currency)}/hora · prioridad{" "}
                {rule.priority}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <PricingRuleDialog
                clubId={club.id}
                sports={sports}
                courtTypes={courtTypes}
                rule={{
                  id: rule.id,
                  name: rule.name,
                  sportId: rule.sportId,
                  courtTypeId: rule.courtTypeId,
                  dayCategory: rule.dayCategory,
                  startTime: rule.startTime,
                  endTime: rule.endTime,
                  pricePerHourCents: rule.pricePerHourCents,
                  priority: rule.priority,
                }}
              />
              <DeletePricingRuleButton id={rule.id} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
