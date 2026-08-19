"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CourtClosureKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { logAudit } from "@/lib/audit";
import { zonedTimeToUtc } from "@/lib/timezone";
import { getDefaultClub } from "@/lib/club";

const closureSchema = z.object({
  courtId: z.string().min(1),
  kind: z.nativeEnum(CourtClosureKind),
  reason: z.string().trim().max(300).optional(),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
});

export async function createClosure(formData: FormData) {
  const staff = await requireRole("STAFF");
  const data = closureSchema.parse(Object.fromEntries(formData.entries()));

  const club = await getDefaultClub();
  const [startDate, startTime] = data.startsAt.split("T");
  const [endDate, endTime] = data.endsAt.split("T");
  const startsAt = zonedTimeToUtc(startDate, startTime, club.timezone);
  const endsAt = zonedTimeToUtc(endDate, endTime, club.timezone);

  if (endsAt <= startsAt) {
    throw new Error("La fecha de fin debe ser posterior a la de inicio.");
  }

  const closure = await prisma.courtClosure.create({
    data: { courtId: data.courtId, kind: data.kind, reason: data.reason, startsAt, endsAt, createdById: staff.id },
  });

  await logAudit({
    actorUserId: staff.id,
    action: "COURT_CLOSURE_CREATED",
    entityType: "CourtClosure",
    entityId: closure.id,
    metadata: data,
  });

  revalidatePath("/admin/maintenance");
  revalidatePath("/admin/calendar");
}

export async function deleteClosure(formData: FormData) {
  const staff = await requireRole("STAFF");
  const id = String(formData.get("id"));

  await prisma.courtClosure.delete({ where: { id } });
  await logAudit({ actorUserId: staff.id, action: "COURT_CLOSURE_DELETED", entityType: "CourtClosure", entityId: id });

  revalidatePath("/admin/maintenance");
  revalidatePath("/admin/calendar");
}
