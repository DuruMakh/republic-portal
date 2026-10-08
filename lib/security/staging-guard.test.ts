import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The production ref on an unresolvable TLD: even a missing guard could reach nothing.
const PRODUCTION_LOOKALIKE = "https://uorvlshbrlbdnbauxsws.supabase.invalid";

function run(args: string[]) {
  return spawnSync(process.execPath, args, {
    encoding: "utf8",
    timeout: 30_000,
    env: {
      PATH: process.env.PATH ?? "",
      NEXT_PUBLIC_SUPABASE_URL: PRODUCTION_LOOKALIKE,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only",
      SUPABASE_SERVICE_ROLE_KEY: "test-only",
    },
  });
}

describe("scripts touch only staging (security audit M6)", () => {
  it.each([
    [["scripts/seed-staging.mjs", "--confirm-ref", "uorvlshbrlbdnbauxsws"]],
    [["scripts/verify-schema.mjs"]],
    [["scripts/verify-security-fixes.mjs"]],
    [["--input-type=module", "-e", "await import('./scripts/security/db.mjs')"]],
  ])("%j refuses a non-staging database and names no ref", (args) => {
    const result = run(args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("only against the staging database");
    expect(`${result.stdout}${result.stderr}`).not.toContain("uorvlshbrlbdnbauxsws");
    expect(`${result.stdout}${result.stderr}`).not.toContain("orcxtbedkexoclbfgvzd");
  });

  it("allows exactly the staging ref that lib/env.ts names", () => {
    const guard = readFileSync("scripts/staging-guard.mjs", "utf8");
    const env = readFileSync("lib/env.ts", "utf8");
    const ref = /STAGING_PROJECT_REF = "([a-z]+)"/.exec(env)?.[1];
    expect(ref).toBe("orcxtbedkexoclbfgvzd");
    expect(guard).toContain(`STAGING_PROJECT_REF = "${ref}"`);
  });
});
