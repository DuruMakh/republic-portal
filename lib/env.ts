/**
 * Production means BOTH: the env flag says so AND the database is not the
 * known staging project. Fail-safe: a mis-set NEXT_PUBLIC_APP_ENV=production
 * while still pointed at staging must NOT enable indexing or hide the demo
 * banner (the data would be fictional people). Both vars are NEXT_PUBLIC_*
 * and inlined at build time on server and client alike.
 */
const STAGING_PROJECT_REF = "orcxtbedkexoclbfgvzd";

export function isProductionEnv(): boolean {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "production") return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url) return false;
  return !url.includes(STAGING_PROJECT_REF);
}
