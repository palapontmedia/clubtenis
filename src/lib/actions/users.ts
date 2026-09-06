"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guards";
import { logAudit } from "@/lib/audit";
import { AppError } from "@/lib/api-error";

const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(Role),
});

/**
 * Role changes are one of the most sensitive admin actions — a bug here is
 * a privilege escalation vulnerability. Only SUPER_ADMIN may grant ADMIN
 * or SUPER_ADMIN; a plain ADMIN can only toggle a user between PLAYER and
 * STAFF, and can never touch another ADMIN/SUPER_ADMIN's role.
 */
export async function updateUserRole(formData: FormData) {
  const actor = await requireRole("ADMIN");
  const data = updateRoleSchema.parse(Object.fromEntries(formData.entries()));

  const targetUser = await prisma.user.findUniqueOrThrow({ where: { id: data.userId } });

  const grantingElevatedRole = data.role === Role.ADMIN || data.role === Role.SUPER_ADMIN;
  const targetIsElevated = targetUser.role === Role.ADMIN || targetUser.role === Role.SUPER_ADMIN;

  if (actor.role !== Role.SUPER_ADMIN && (grantingElevatedRole || targetIsElevated)) {
    throw new AppError("Solo un super administrador puede gestionar roles de administración.", 403, "FORBIDDEN");
  }

  // A role change (elevation or, more importantly, degradation of a
  // compromised/offboarded admin) revokes the target's existing sessions
  // so a stale JWT can't keep acting with the old privileges.
  await prisma.user.update({
    where: { id: data.userId },
    data: { role: data.role, sessionsValidFrom: new Date() },
  });
  await logAudit({
    actorUserId: actor.id,
    action: "USER_ROLE_UPDATED",
    entityType: "User",
    entityId: data.userId,
    metadata: { newRole: data.role, previousRole: targetUser.role },
  });

  revalidatePath("/admin/users");
}
