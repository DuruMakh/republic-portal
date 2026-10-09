/**
 * Production means BOTH: the env flag says so AND the database is not the
 * known staging project. Fail-safe: a mis-set NEXT_PUBLIC_APP_ENV=production
 * while still pointed at staging must NOT enable indexing or hide the demo
 * banner (the data would be fictional people). Both vars are NEXT_PUBLIC_*
 * and inlined at build time on server and client alike.
 */
export const STAGING_PROJECT_REF = "orcxtbedkexoclbfgvzd";
/** The throwaway Supabase stack CI starts with `supabase start` (spec 2026-10-08 simpler dev structure 4.1). */
export const LOCAL_SUPABASE_ORIGINS: readonly string[] = [
  "http://127.0.0.1:54321",
  "http://localhost:54321",
];

export function isProductionEnv(): boolean {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "production") return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url) return false;
  return !url.includes(STAGING_PROJECT_REF);
}

/** Allow-list of databases that hold only made-up people: staging and the local CI stack. */
export function isTestDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (LOCAL_SUPABASE_ORIGINS.includes(parsed.origin)) return true;
  return parsed.protocol === "https:" && parsed.hostname === `${STAGING_PROJECT_REF}.supabase.co`;
}

/**
 * Preview test sign-in (spec 4.3): never on a live Vercel deployment, only on an explicit
 * preview or development build, and only on a test database. VERCEL_ENV is set by Vercel at
 * runtime and no build setting overrides it, which matters because the demo project's
 * production site is built with APP_ENV=preview on staging (ADR-047). The other two are
 * allow-lists, so an unset or mistyped flag keeps it off.
 */
export function testSignInEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV;
  if (appEnv !== "preview" && appEnv !== "development") return false;
  return isTestDatabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
}
