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
    // every lookup of a live challenge (linked, found, and the supersede itself) skips superseded
    expect(body.match(/superseded_at is null/g)?.length).toBeGreaterThanOrEqual(3);
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
  // comments stripped, so a commented-out revoke cannot satisfy these checks
  const sql = orderedMigrationSql().replace(/--[^\n]*/g, "");
  const signature = String.raw`(?:public\.)?register\(text, ?text, ?text, ?text\)`;

  it("ends revoked from authenticated, after every grant and every (re)definition", () => {
    const lastRevoke = lastMatchIndex(
      sql,
      new RegExp(`revoke execute on function ${signature} from [^;]*\\bauthenticated\\b`, "g"),
    );
    // a grant to PUBLIC reaches authenticated too, and so does a schema-wide grant
    const lastGrant = lastMatchIndex(
      sql,
      new RegExp(
        `grant execute on (?:function ${signature}|all functions in schema public) to [^;]*\\b(?:authenticated|public)\\b`,
        "g",
      ),
    );
    const lastCreate = lastMatchIndex(
      sql,
      /create (?:or replace )?function (?:public\.)?register\s*\(/g,
    );
    expect(lastRevoke).toBeGreaterThan(lastGrant);
    expect(lastRevoke).toBeGreaterThan(lastCreate);
  });

  it("is closed to every API role, service_role included (nothing calls it directly)", () => {
    expect(sql).toMatch(
      new RegExp(
        `revoke execute on function ${signature} from public, anon, authenticated, service_role;`,
      ),
    );
  });

  it("is checked as revoked by the production schema check", () => {
    const check = readFileSync(resolve("scripts/production-db-schema-check.sql"), "utf8");
    expect(check).toContain("legacy register function is still executable by authenticated");
    expect(check).not.toContain("legacy register function privileges changed before hardening");
    expect(check).toContain("superseded_at");
  });
});

describe("personal-ID conflicts at the membership step (security audit H1)", () => {
  const body = () => latestDefinition("become_member_save_profile");

  it("refuses a read-only call before any lookup (a GET would otherwise probe without a trace)", () => {
    const b = body();
    const guard = b.indexOf("current_setting('transaction_read_only')");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(b.indexOf("from public.audit_log"));
    expect(guard).toBeLessThan(b.indexOf("pr.personal_id = p_personal_id"));
    expect(b).toContain("raise exception 'read_only_transaction'");
  });

  it("counts conflicts through a partial index", () => {
    expect(orderedMigrationSql()).toMatch(
      /create index audit_log_personal_id_conflicts\s+on public\.audit_log \(target_id\)\s+where action = 'member\.personal_id_conflict'/,
    );
  });

  it("resolves the delegate before it looks at the personal ID", () => {
    const b = body();
    expect(b.indexOf("raise exception 'invalid_delegate'")).toBeGreaterThan(-1);
    expect(b.indexOf("raise exception 'invalid_delegate'")).toBeLessThan(
      b.indexOf("pr.personal_id = p_personal_id"),
    );
  });

  it("caps conflicts at three per account for good, counted from the audit log (D2)", () => {
    const b = body();
    expect(b).toContain("action = 'member.personal_id_conflict'");
    expect(b).toContain("target_id = v_uid::text");
    // no daily reset: a time window would let a patient prober keep asking
    expect(b).not.toContain("interval '24 hours'");
    expect(b).toMatch(/v_conflicts >= 3 then\s+raise exception 'personal_id_attempts_exceeded'/);
  });

  it("returns the refusal so the audit row commits, and never stores the tried ID", () => {
    const b = body();
    expect(b).toContain("return jsonb_build_object('error', 'duplicate_personal_id')");
    expect(b).not.toContain("raise exception 'duplicate_personal_id'");
    expect(b).toMatch(
      /values \(null, 'member\.personal_id_conflict', 'profile', v_uid::text, null\)/,
    );
  });
});
