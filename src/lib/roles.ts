import type { Role } from "@prisma/client";

// Pure role-ranking logic, deliberately free of any Next.js/Auth.js
// dependency so it (and reservations.ts, which needs the error types
// alongside it) can be unit-tested without a NextAuth runtime.
const ROLE_RANK: Record<Role, number> = {
  PLAYER: 0,
  STAFF: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export function hasRole(role: Role, minRole: Role) {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}
