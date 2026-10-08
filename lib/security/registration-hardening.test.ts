import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lastMatchIndex, latestDefinition, orderedMigrationSql } from "./migration-model";

describe("phone proof supersede (security audit C1)", () => {
  it("marks a superseded challenge explicitly, never as consumed", () => {
    const body = latestDefinition("complete_phone_verification_send");
    expect(body).toContain("set superseded_at = v_now");
    expect(body).not.toContain("interval '1 microsecond'");
    expect(body).toContain("and superseded_at is null");
  });

  it("refuses attempts and consumption on a superseded challenge", () => {
    expect(latestDefinition("reserve_phone_verification_attempt")).toContain(
      "and superseded_at is null",
    );
    expect(latestDefinition("consume_phone_verification_challenge")).toContain(
      "and superseded_at is null",
    );
  });

  it("adds the column with its exclusivity check and backfills the old marker", () => {
    const sql = orderedMigrationSql();
    expect(sql).toMatch(/add column superseded_at timestamptz/);
    expect(sql).toMatch(/check \(consumed_at is null or superseded_at is null\)/);
    expect(sql).toMatch(
      /set superseded_at = pg_catalog\.now\(\),\s*consumed_at = null\s*where consumed_at > expires_at/,
    );
  });
});

describe("legacy register() (security audit C1)", () => {
  const sql = orderedMigrationSql();
  const signature = String.raw`(?:public\.)?register\(text, ?text, ?text, ?text\)`;

  it("ends revoked from authenticated, after every grant and every (re)definition", () => {
    const lastRevoke = lastMatchIndex(
      sql,
      new RegExp(`revoke execute on function ${signature} from [^;]*\\bauthenticated\\b`, "g"),
    );
    const lastGrant = lastMatchIndex(
      sql,
      new RegExp(`grant execute on function ${signature} to [^;]*\\bauthenticated\\b`, "g"),
    );
    const lastCreate = lastMatchIndex(
      sql,
      /create (?:or replace )?function (?:public\.)?register\s*\(/g,
    );
    expect(lastRevoke).toBeGreaterThan(lastGrant);
    expect(lastRevoke).toBeGreaterThan(lastCreate);
  });

  it("is checked as revoked by the production schema check", () => {
    const check = readFileSync(resolve("scripts/production-db-schema-check.sql"), "utf8");
    expect(check).toContain("legacy register function is still executable by authenticated");
    expect(check).not.toContain("legacy register function privileges changed before hardening");
    expect(check).toContain("superseded_at");
  });
});
