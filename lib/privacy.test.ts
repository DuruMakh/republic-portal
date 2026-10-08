import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PRIVACY_POLICY_PATH, PRIVACY_POLICY_VERSION } from "./privacy";

/**
 * Static model of the applied migrations, same discipline as
 * lib/security/verdict.tokens-drift.test.ts: read the real SQL, never a copy of it.
 * Last definition wins, exactly as Postgres applies them in filename order.
 */
const MIGRATIONS_DIR = resolve("supabase/migrations");

function latestDefinition(fn: string): string {
  let found: string | undefined;
  const header = new RegExp(`create (?:or replace )?function\\s+(?:public\\.)?${fn}\\s*\\(`, "g");
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    if (!file.endsWith(".sql")) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const match of sql.matchAll(header)) {
      const open = sql.indexOf("$$", match.index);
      const close = sql.indexOf("$$", open + 2);
      if (open < 0 || close < 0) continue;
      found = sql.slice(match.index, close);
    }
  }
  if (found === undefined) throw new Error(`no definition of ${fn} in the migrations`);
  return found;
}

describe("privacy policy constants", () => {
  it("names the published policy page and a dated version", () => {
    expect(PRIVACY_POLICY_PATH).toBe("/privacy");
    expect(PRIVACY_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-v\d+$/);
  });
});

describe("register() records privacy consent", () => {
  it("takes the policy version as an optional fourth argument", () => {
    expect(latestDefinition("register")).toMatch(/p_privacy_version text default null\s*\)/);
  });

  it("refuses any version other than the current one, with the classified token", () => {
    const body = latestDefinition("register");
    expect(body).toContain(`'${PRIVACY_POLICY_VERSION}'`);
    expect(body).toContain("raise exception 'privacy_consent_required'");
  });

  it("stamps the consent date and version on the new profile", () => {
    expect(latestDefinition("register")).toMatch(
      /insert into public\.profiles \([^)]*privacy_accepted_at, privacy_version\)/,
    );
  });

  it("is reached from register_google() with the version passed through", () => {
    const body = latestDefinition("register_google");
    expect(body).toMatch(/p_privacy_version text default null\s*\)/);
    expect(body).toContain(
      "public.register(p_first_name, p_last_name, p_ref_code, p_privacy_version)",
    );
  });

  it("keeps both consent columns server-managed", () => {
    const body = latestDefinition("protect_profile_columns");
    expect(body).toContain("new.privacy_accepted_at is distinct from old.privacy_accepted_at");
    expect(body).toContain("new.privacy_version is distinct from old.privacy_version");
  });

  it("is checked by the production schema check under its four-argument signatures", () => {
    const check = readFileSync(resolve("scripts/production-db-schema-check.sql"), "utf8");
    expect(check).toContain("public.register_google(text,text,text,text)");
    expect(check).toContain("public.register(text,text,text,text)");
    expect(check).not.toContain("public.register_google(text,text,text)'");
    expect(check).not.toContain("public.register(text,text,text)'");
  });
});
