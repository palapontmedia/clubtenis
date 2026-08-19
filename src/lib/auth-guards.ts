import "server-only";

import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";

export { hasRole } from "@/lib/roles";
export { UnauthorizedError, ForbiddenError } from "@/lib/errors";

/** For Server Actions / Route Handlers: throws instead of redirecting. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  return session.user;
}

/** For Server Actions / Route Handlers: throws if role rank is insufficient. */
export async function requireRole(minRole: Role) {
  const user = await requireUser();
  if (!hasRole(user.role, minRole)) {
    throw new ForbiddenError();
  }
  return user;
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
  if (!hasRole(user.role, "STAFF")) {
    redirect("/");
  }
  return user;
}
