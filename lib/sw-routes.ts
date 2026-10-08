/**
 * What the service worker must never put in Cache Storage. A cached response outlives
 * sign-out on a shared or seized phone (security audit 2026-10-08, M3).
 */
export const PROTECTED_PREFIXES = ["/me", "/delegate", "/admin", "/api", "/login"] as const;

export function isNeverCached(url: URL, sameOrigin: boolean): boolean {
  // Cross-origin = Supabase (auth, data, storage). The public site never needs it offline.
  if (!sameOrigin) return true;
  return PROTECTED_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));
}

/** Runtime caches are emptied on sign-out; the precache only holds the offline shell. */
export function runtimeCachesToClear(names: readonly string[]): string[] {
  return names.filter((name) => !name.includes("precache"));
}
