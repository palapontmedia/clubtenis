"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { logAudit } from "@/lib/audit";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAYS = [0, 1, 2, 3, 4, 5, 6];

export async function updateOpeningHours(formData: FormData) {
  const staff = await requireRole("ADMIN");
  const clubId = String(formData.get("clubId"));

  const updates = DAYS.map((day) => {
    const closed = formData.get(`closed-${day}`) === "true";
    const opensAt = String(formData.get(`opensAt-${day}`) ?? "08:00");
    const closesAt = String(formData.get(`closesAt-${day}`) ?? "22:00");

    if (!timeRegex.test(opensAt) || !timeRegex.test(closesAt)) {
      throw new Error("Formato de hora inválido.");
    }

    return prisma.clubOpeningHours.upsert({
      where: { clubId_dayOfWeek: { clubId, dayOfWeek: day } },
      create: { clubId, dayOfWeek: day, opensAt, closesAt, closed },
      update: { opensAt, closesAt, closed },
    });
  });

  await prisma.$transaction(updates);
  await logAudit({ actorUserId: staff.id, action: "OPENING_HOURS_UPDATED", entityType: "Club", entityId: clubId });

  revalidatePath("/admin/hours");
}

const holidaySchema = z.object({
  clubId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1).max(100),
});

export async function createHoliday(formData: FormData) {
  const staff = await requireRole("ADMIN");
  const data = holidaySchema.parse(Object.fromEntries(formData.entries()));

  const holiday = await prisma.clubHoliday.create({
    data: { clubId: data.clubId, date: new Date(data.date), name: data.name },
  });

  await logAudit({ actorUserId: staff.id, action: "HOLIDAY_CREATED", entityType: "ClubHoliday", entityId: holiday.id, metadata: data });

  revalidatePath("/admin/hours");
}

export async function deleteHoliday(formData: FormData) {
  const staff = await requireRole("ADMIN");
  const id = String(formData.get("id"));

  await prisma.clubHoliday.delete({ where: { id } });
  await logAudit({ actorUserId: staff.id, action: "HOLIDAY_DELETED", entityType: "ClubHoliday", entityId: id });

  revalidatePath("/admin/hours");
}
