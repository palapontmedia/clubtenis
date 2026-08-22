---
name: project-conventions
description: "Background domain knowledge for the Rally club booking app: reservation/availability invariants, and what requires explicit user permission before touching. Not user-invocable — Claude should apply this automatically when working in this repo."
user-invocable: false
---

# Rally booking domain — invariants and guardrails

Background knowledge for working in this codebase (club de tenis/pádel booking app). Applies automatically; no need to invoke by name.

## Domain map

- `src/lib/availability.ts` — `getAvailability()` is the single source of truth for "what's bookable." Never re-derive slot/blocking logic elsewhere; extend this function instead.
- `src/lib/pricing.ts` — `computePrice()` (single window, does its own DB reads) and `getPricingContext()` + `computePriceFromContext()` (fetch once, reuse across many windows — use this pair inside any loop over slots/courts, never call `computePrice()` per-iteration).
- `src/lib/timezone.ts` — all club-local wall-clock math goes through `zonedTimeToUtc()` / `getZonedParts()`. Never do manual UTC offset arithmetic for club hours.
- `src/lib/reservations.ts` / `src/lib/actions/reservations-admin.ts` — reservation creation (customer-facing and admin-manual paths).
- `src/app/api/availability/route.ts` + `src/app/search/page.tsx` — the two consumers of `getAvailability()`: the client-side "Hora disponible" picker fetches the API route; the `/search` results page calls `getAvailability()` server-side again and filters to the chosen `startsAt`, always re-validating against a fresh read rather than trusting the query param.

## Invariants that must never regress

- **A slot is only available if `isCourtWindowFree()` (or the equivalent live check inside `getAvailability()`) says so at the moment of the check.** Client-supplied court/time/price is never authoritative — every booking-affecting server code path re-derives it.
- **Double-booking prevention is two intentional layers, not one — never remove either independently:**
  1. **Application-level**: `isCourtWindowFree()` / the blocking check inside `getAvailability()`. This is the fast pre-check that drives the normal flow and gives the user immediate feedback (available vs. taken) before they even attempt to reserve.
  2. **Database-level backstop**: the PostgreSQL exclusion constraint **`Reservation_no_overlap_per_court`** (a GiST constraint on `Reservation`, added in `prisma/migrations/*_init` — see the comment above `createPendingReservation()` in `src/lib/reservations.ts`). This is the actual, transactional guarantee: when two requests race past the application-level pre-check at the same time, the constraint ensures only one `INSERT` can succeed. The loser's insert failure is caught and turned into a friendly `SLOT_TAKEN` error by re-checking availability, not treated as an unexpected error.

  The app check exists for UX (fast, friendly, no DB-transaction overhead for the common case); the DB constraint exists for correctness under concurrency (the app check alone has a race window between "check" and "insert" that only a DB-level constraint can close). A change that only strengthens the app-level check without the DB constraint still leaves a real double-booking window.
- **`expireStalePendingReservations()` runs before any availability read or booking attempt**, and specifically *before* the reservations/closures query that determines blocking — not in parallel with it. A hold expiring mid-request must never be treated as still blocking (would show a false unavailable), nor can the expiry write race behind the read (would double-book). Preserve this ordering in any refactor.
- **Opening hours, `CourtClosure` (maintenance/holiday/event), and `PENDING_PAYMENT` holds all gate availability independently.** A change that touches one must not silently bypass the others.
- **Prices shown to a user are never trusted back from the client.** `computePrice()` / `computePriceFromContext()` is the only source of a chargeable amount; reservation creation recomputes it server-side even if the client sent a price.

## Requires explicit user permission before touching

These come up often enough in this repo that they're worth stating once instead of re-litigating per task — but "listed here" does not mean "pre-approved silently"; still confirm with the user unless they've already scoped the task to include it:

- Prisma schema/migrations (`prisma/schema.prisma`, `prisma/migrations/`) — only with a demonstrated, necessary reason.
- `.env`, `.env.test`, `.env.example`, or any secret/credential value.
- Stripe integration (`src/lib/payments.ts`, `/api/payments/*`, `/api/webhooks/stripe`).
- Auth (`src/lib/auth-guards.ts`, NextAuth config, role checks).
- The admin panel (`src/app/admin/**`) and global design/layout, unless the task is explicitly about them.
- Existing routes and the booking/search UI structure — prefer additive, minimal changes over restructuring.

## Working style established in this repo

- Use graphify (`graphify query`/`path`/`explain`) to locate relevant code before reading files cold — it's wired in as a hook here.
- Before a perf or correctness fix, measure/confirm the real cause (e.g. count actual Prisma queries) rather than assuming from a first read.
- After code changes: `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test && corepack pnpm build`, plus a manual check of the specific behavior touched (availability, booking, revalidation) before calling a task done.
