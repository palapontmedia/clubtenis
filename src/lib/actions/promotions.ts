"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DiscountType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { logAudit } from "@/lib/audit";

const promotionSchema = z.object({
  clubId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300).optional(),
  discountType: z.nativeEnum(DiscountType),
  discountValue: z.coerce.number().positive(),
  sportId: z.string().optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  code: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/),
  maxRedemptions: z.coerce.number().int().positive().optional(),
});

export async function createPromotion(formData: FormData) {
  const staff = await requireRole("ADMIN");
  const data = promotionSchema.parse(Object.fromEntries(formData.entries()));

  const discountValue =
    data.discountType === DiscountType.PERCENTAGE ? Math.round(data.discountValue) : Math.round(data.discountValue * 100);

  const promotion = await prisma.promotion.create({
    data: {
      clubId: data.clubId,
      name: data.name,
      description: data.description,
      discountType: data.discountType,
      discountValue,
      sportId: data.sportId || null,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      promoCodes: {
        create: { code: data.code.toUpperCase(), maxRedemptions: data.maxRedemptions },
      },
    },
  });

  await logAudit({ actorUserId: staff.id, action: "PROMOTION_CREATED", entityType: "Promotion", entityId: promotion.id, metadata: data });

  revalidatePath("/admin/promotions");
}

export async function togglePromotionActive(formData: FormData) {
  const staff = await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";

  await prisma.promotion.update({ where: { id }, data: { active: !active } });
  await logAudit({ actorUserId: staff.id, action: "PROMOTION_TOGGLED", entityType: "Promotion", entityId: id, metadata: { active: !active } });

  revalidatePath("/admin/promotions");
}
