"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { logAudit } from "@/lib/audit";

const clubInfoSchema = z.object({
  clubId: z.string().min(1),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).optional(),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
});

export async function updateClubInfo(formData: FormData) {
  const staff = await requireRole("SUPER_ADMIN");
  const data = clubInfoSchema.parse(Object.fromEntries(formData.entries()));

  await prisma.club.update({
    where: { id: data.clubId },
    data: {
      name: data.name,
      description: data.description,
      address: data.address,
      phone: data.phone,
      email: data.email || undefined,
    },
  });

  await logAudit({ actorUserId: staff.id, action: "CLUB_INFO_UPDATED", entityType: "Club", entityId: data.clubId });
  revalidatePath("/admin/settings");
}

const tiersSchema = z.object({
  clubId: z.string().min(1),
  policyId: z.string().min(1),
  minHoursBefore: z.array(z.coerce.number().int().min(0)),
  refundPercentage: z.array(z.coerce.number().int().min(0).max(100)),
});

export async function updateCancellationPolicy(formData: FormData) {
  const staff = await requireRole("SUPER_ADMIN");

  const minHoursBefore = formData.getAll("minHoursBefore");
  const refundPercentage = formData.getAll("refundPercentage");
  const data = tiersSchema.parse({
    clubId: formData.get("clubId"),
    policyId: formData.get("policyId"),
    minHoursBefore,
    refundPercentage,
  });

  await prisma.$transaction([
    prisma.cancellationPolicyTier.deleteMany({ where: { policyId: data.policyId } }),
    prisma.cancellationPolicyTier.createMany({
      data: data.minHoursBefore.map((hours, i) => ({
        policyId: data.policyId,
        minHoursBefore: hours,
        refundPercentage: data.refundPercentage[i] ?? 0,
      })),
    }),
  ]);

  await logAudit({ actorUserId: staff.id, action: "CANCELLATION_POLICY_UPDATED", entityType: "CancellationPolicy", entityId: data.policyId });
  revalidatePath("/admin/settings");
}
