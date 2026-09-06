/**
 * A JWT session is honoured only if the sign-in that minted it happened at
 * or after the user's `sessionsValidFrom` cutoff. Password reset and role
 * changes bump that cutoff (see reset-password route and updateUserRole),
 * so every token issued before them stops being accepted — within one
 * role-refresh cycle of the jwt callback in src/lib/auth.ts, never per
 * request.
 *
 * Pure and dependency-free so it can be unit-tested without an Auth.js
 * runtime or a database.
 */
export function isSessionStillValid(
  loginAtMs: number,
  sessionsValidFrom: Date | null | undefined
): boolean {
  if (!sessionsValidFrom) return true;
  return loginAtMs >= sessionsValidFrom.getTime();
}
