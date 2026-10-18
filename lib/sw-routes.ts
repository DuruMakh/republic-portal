/**
 * What the service worker must never put in Cache Storage. A cached response outlives
 * sign-out on a shared or seized phone (security audit 2026-10-08, M3). /join renders the
 * signed-in registration wizard (Google name, proven phone); /auth is the sign-in return.
 */
export const PROTECTED_PREFIXES = [
  "/me",
  "/delegate",
  "/admin",
  "/api",
  "/login",
  "/join",
  "/auth",
] as const;

export function offlineDocument(pathname: string): "/offline" | "/en/offline" {
  return /^\/en(?:\/|$)/.test(pathname) ? "/en/offline" : "/offline";
}

export function isNeverCached(url: URL, sameOrigin: boolean): boolean {
  // Cross-origin = Supabase (auth, data, storage). The public site never needs it offline.
  if (!sameOrigin) return true;
  const pathname = url.pathname.replace(/^\/(?:en|ka)(?=\/|$)/, "") || "/";
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * The @serwist/next defaultCache caches that can hold a page, data or an image someone saw
 * while signed in. Sign-out empties exactly these; the code, style and font caches (which the
 * offline page needs) and the precache stay.
 */
const PERSONAL_CACHES: ReadonlySet<string> = new Set([
  "cross-origin",
  "pages",
  "pages-rsc",
  "pages-rsc-prefetch",
  "others",
  "apis",
  "next-data",
  "static-data-assets",
  "static-image-assets",
  "next-image",
]);

export function runtimeCachesToClear(names: readonly string[]): string[] {
  return names.filter((name) => PERSONAL_CACHES.has(name));
}
