"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DayCategory } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { logAudit } from "@/lib/audit";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const pricingRuleSchema = z.object({
  id: z.string().optional(),
  clubId: z.string().min(1),
  sportId: z.string().min(1),
  courtTypeId: z.string().optional(),
  name: z.string().trim().min(1).max(100),
  dayCategory: z.nativeEnum(DayCategory),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  pricePerHourEuros: z.coerce.number().min(0),
  priority: z.coerce.number().int().min(0).max(100).default(1),
});

export async function upsertPricingRule(formData: FormData) {
  const user = await requireRole("ADMIN");
  const data = pricingRuleSchema.parse(Object.fromEntries(formData.entries()));

  if (data.startTime >= data.endTime) {
    throw new Error("La hora de inicio debe ser anterior a la hora de fin.");
  }

  const fields = {
    sportId: data.sportId,
    courtTypeId: data.courtTypeId || null,
    name: data.name,
    dayCategory: data.dayCategory,
    startTime: data.startTime,
    endTime: data.endTime,
    pricePerHourCents: Math.round(data.pricePerHourEuros * 100),
    priority: data.priority,
  };

  const rule = data.id
    ? await prisma.pricingRule.update({ where: { id: data.id }, data: fields })
    : await prisma.pricingRule.create({ data: { ...fields, clubId: data.clubId } });

  await logAudit({
    actorUserId: user.id,
    action: data.id ? "PRICING_RULE_UPDATED" : "PRICING_RULE_CREATED",
    entityType: "PricingRule",
    entityId: rule.id,
    metadata: data,
  });

  revalidatePath("/admin/pricing");
}

export async function deletePricingRule(formData: FormData) {
  const user = await requireRole("ADMIN");
  const id = String(formData.get("id"));

  await prisma.pricingRule.delete({ where: { id } });
  await logAudit({ actorUserId: user.id, action: "PRICING_RULE_DELETED", entityType: "PricingRule", entityId: id });

  revalidatePath("/admin/pricing");
}
