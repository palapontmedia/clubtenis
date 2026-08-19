"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { logAudit } from "@/lib/audit";

const courtSchema = z.object({
  id: z.string().optional(),
  clubId: z.string().min(1),
  sportId: z.string().min(1),
  courtTypeId: z.string().optional(),
  name: z.string().trim().min(1).max(100),
  indoor: z.coerce.boolean().default(false),
  covered: z.coerce.boolean().default(false),
  active: z.coerce.boolean().default(true),
  basePriceEuros: z.coerce.number().min(0),
  description: z.string().trim().max(500).optional(),
});

export async function upsertCourt(formData: FormData) {
  const user = await requireRole("ADMIN");
  const raw = Object.fromEntries(formData.entries());
  const data = courtSchema.parse(raw);

  const fields = {
    sportId: data.sportId,
    courtTypeId: data.courtTypeId || null,
    name: data.name,
    indoor: data.indoor,
    covered: data.covered,
    active: data.active,
    basePriceCents: Math.round(data.basePriceEuros * 100),
    description: data.description,
  };

  const court = data.id
    ? await prisma.court.update({ where: { id: data.id }, data: fields })
    : await prisma.court.create({ data: { ...fields, clubId: data.clubId } });

  await logAudit({
    actorUserId: user.id,
    action: data.id ? "COURT_UPDATED" : "COURT_CREATED",
    entityType: "Court",
    entityId: court.id,
    metadata: data,
  });

  revalidatePath("/admin/courts");
}

export async function toggleCourtActive(formData: FormData) {
  const user = await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";

  await prisma.court.update({ where: { id }, data: { active: !active } });
  await logAudit({ actorUserId: user.id, action: "COURT_TOGGLED", entityType: "Court", entityId: id, metadata: { active: !active } });

  revalidatePath("/admin/courts");
}
