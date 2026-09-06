/**
 * The only sanctioned way to turn a `callbackUrl`/`back` query value into a
 * redirect target across the app: login, registration, and the booking
 * hand-off page all go through this so an anonymous user lands back right
 * where they were without `callbackUrl` ever becoming an open-redirect
 * gadget. Only an internal, same-origin path (starts with a single `/`,
 * never `//`) is ever honored — anything else falls back to `fallback`.
 */
export function resolveInternalRedirect(requested: string | null | undefined, fallback: string): string {
  if (requested && requested.startsWith("/") && !requested.startsWith("//")) {
    return requested;
  }
  return fallback;
}
