/**
 * Destructive and probing scripts may only ever touch the STAGING project (security audit
 * 2026-10-08, M6). Allow-list, not deny-list: a missing, mistyped or production URL is refused,
 * whatever NEXT_PUBLIC_APP_ENV says. The refusal names no project ref, so there is nothing to
 * copy into a confirm flag. Keep STAGING_PROJECT_REF equal to lib/env.ts (a test checks it).
 */
export const STAGING_PROJECT_REF = "orcxtbedkexoclbfgvzd";

export function assertStagingTarget(url) {
  let ref = "";
  try {
    ref = new URL(url ?? "").hostname.split(".")[0] ?? "";
  } catch {
    ref = "";
  }
  if (ref !== STAGING_PROJECT_REF) {
    console.error("Refusing: this script runs only against the staging database.");
    process.exit(1);
  }
}
