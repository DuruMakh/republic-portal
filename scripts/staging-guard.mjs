/**
 * Destructive and probing scripts may only ever touch a test database: the STAGING project or the
 * throwaway local stack CI starts (security audit 2026-10-08, M6; spec 2026-10-08 simpler dev
 * structure 4.1). Allow-list, not deny-list: a missing, mistyped or production URL is refused,
 * whatever NEXT_PUBLIC_APP_ENV says. The refusal names no project ref, so there is nothing to copy
 * into a confirm flag. Keep both constants equal to lib/env.ts (a test checks it).
 */
export const STAGING_PROJECT_REF = "orcxtbedkexoclbfgvzd";
export const LOCAL_SUPABASE_ORIGINS = ["http://127.0.0.1:54321", "http://localhost:54321"];

/** @returns {"staging" | "local"} which allow-listed target the URL points at */
export function assertStagingTarget(url) {
  let parsed = null;
  try {
    parsed = new URL(url ?? "");
  } catch {
    parsed = null;
  }
  if (parsed && LOCAL_SUPABASE_ORIGINS.includes(parsed.origin)) return "local";
  if (parsed && parsed.hostname.split(".")[0] === STAGING_PROJECT_REF) return "staging";
  console.error("Refusing: this script runs only against the staging database.");
  process.exit(1);
}
