/**
 * The only sanctioned way to turn a `callbackUrl`/`back` query value into a
 * redirect target across the app: login, registration, and the booking
 * hand-off page all go through this so an anonymous user lands back right
 * where they were without `callbackUrl` ever becoming an open-redirect
 * gadget.
 *
 * Only an internal, same-origin path is honored: it must start with a single
 * `/` that is NOT followed by another `/` or a `\`. That rejects both the
 * classic protocol-relative bypass (`//evil.com`) and the backslash variant
 * (`/\evil.com`, `/\/evil.com`) that some browsers normalize into one.
 * Anything else falls back to `fallback`.
 */
export function resolveInternalRedirect(requested: string | null | undefined, fallback: string): string {
  if (requested && /^\/(?![/\\])/.test(requested)) {
    return requested;
  }
  return fallback;
}
