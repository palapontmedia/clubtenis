import "server-only";

import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

import { auth } from "@/lib/auth";

const ROLE_RANK: Record<Role, number> = {
  PLAYER: 0,
  STAFF: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export class UnauthorizedError extends Error {
  constructor(message = "No autenticado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "No autorizado") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** For Server Actions / Route Handlers: throws instead of redirecting. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  return session.user;
}

/** For Server Actions / Route Handlers: throws if role rank is insufficient. */
export async function requireRole(minRole: Role) {
  const user = await requireUser();
  if (ROLE_RANK[user.role] < ROLE_RANK[minRole]) {
    throw new ForbiddenError();
  }
  return user;
}

export function hasRole(role: Role, minRole: Role) {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

/** For Server Components / Pages: redirects instead of throwing. */
export async function requireUserOrRedirect(callbackUrl = "/") {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  return session.user;
}

/** For Server Components / Pages under /admin: redirects to home if underprivileged. */
export async function requireStaffOrRedirect() {
  const user = await requireUserOrRedirect("/admin");
  if (ROLE_RANK[user.role] < ROLE_RANK.STAFF) {
    redirect("/");
  }
  return user;
}
