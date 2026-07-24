import { describe, expect, it } from "vitest";
import { defaultExpectation, isRuleDerived } from "./expectations";
import type { Surface } from "./types";

const fn = (name: string, overrides?: Surface["overrides"]): Surface => ({
  id: `fn:${name}`,
  kind: "function",
  name,
  layer: "db",
  overrides,
});

const view = (name: string, overrides?: Surface["overrides"]): Surface => ({
  id: `view:${name}`,
  kind: "view",
  name,
  layer: "db",
  overrides,
});

const table = (name: string, overrides?: Surface["overrides"]): Surface => ({
  id: `table:${name}`,
  kind: "table",
  name,
  layer: "db",
  overrides,
});

describe("defaultExpectation", () => {
  it("denies admin_ functions to every non-admin actor", () => {
    for (const actor of ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"] as const) {
      expect(defaultExpectation(fn("admin_record_payment"), actor)).toBe("deny");
    }
  });

  it("allows admin_ functions to super_admin", () => {
    expect(defaultExpectation(fn("admin_record_payment"), "A9")).toBe("allow");
  });

  it("denies a finance function to the editor role", () => {
    expect(defaultExpectation(fn("admin_record_payment"), "A12")).toBe("deny");
  });

  it("denies everything to the anonymous actor by default", () => {
    expect(defaultExpectation(fn("member_change_tier"), "A1")).toBe("deny");
  });

  it("honours an explicit override above the rule", () => {
    const surface = fn("member_change_tier", { A1: "allow" });
    expect(defaultExpectation(surface, "A1")).toBe("allow");
  });

  // --- Regression coverage for the ROLE_FAMILIES corrections made against
  // supabase/migrations/20260717150000_admin_crm.sql and the later migrations
  // that extend it (see task-2-report.md for the full evidence trail). The
  // brief's starting table was wrong or incomplete in several places; these
  // pin the corrected behaviour so it cannot silently regress.

  it("denies admin_reveal_personal_id to verifier — super_admin-only in the migration, despite sharing the admin_reveal_ prefix with an applicant-scoped sibling", () => {
    // supabase/migrations/20260717150000_admin_crm.sql:716 — single-role
    // check (`has_admin_role('super_admin')`), no has_any_admin_role fallback.
    expect(defaultExpectation(fn("admin_reveal_personal_id"), "A10")).toBe("deny");
  });

  it("allows admin_reveal_applicant_personal_id to verifier", () => {
    // supabase/migrations/20260717150000_admin_crm.sql:735 —
    // has_any_admin_role('super_admin', 'verifier').
    expect(defaultExpectation(fn("admin_reveal_applicant_personal_id"), "A10")).toBe("allow");
  });

  it("allows admin_reassign_member to verifier, not finance", () => {
    // supabase/migrations/20260717150000_admin_crm.sql:658 (unchanged through
    // 20260722120000_r2_ladder_and_numbers.sql) —
    // has_any_admin_role('super_admin', 'verifier'). Finance is NOT included,
    // even though this is a member/payment-adjacent action.
    expect(defaultExpectation(fn("admin_reassign_member"), "A10")).toBe("allow");
    expect(defaultExpectation(fn("admin_reassign_member"), "A11")).toBe("deny");
  });

  it("allows admin_update_delegate_profile to verifier", () => {
    // supabase/migrations/20260717150000_admin_crm.sql:430 —
    // has_any_admin_role('super_admin', 'verifier').
    expect(defaultExpectation(fn("admin_update_delegate_profile"), "A10")).toBe("allow");
  });

  it("allows admin_void_payment and admin_export_members to finance", () => {
    // supabase/migrations/20260717150000_admin_crm.sql:617 (admin_void_payment)
    // and :763, latest body at 20260721120000_progressive_registration.sql:266
    // (admin_export_members) — both has_any_admin_role('super_admin', 'finance').
    expect(defaultExpectation(fn("admin_void_payment"), "A11")).toBe("allow");
    expect(defaultExpectation(fn("admin_export_members"), "A11")).toBe("allow");
  });

  it("allows admin_unpublish_news and admin_set_news_image to editor", () => {
    // supabase/migrations/20260719150000_community.sql:351 (admin_unpublish_news)
    // and :404, latest body at 20260722120000_r2_ladder_and_numbers.sql:420
    // (admin_set_news_image) — both has_any_admin_role('super_admin', 'editor').
    expect(defaultExpectation(fn("admin_unpublish_news"), "A12")).toBe("allow");
    expect(defaultExpectation(fn("admin_set_news_image"), "A12")).toBe("allow");
  });

  it("allows the self-gating admin_ views to the roles their WHERE clause names, not just admin_ functions", () => {
    // The naming rule is kind-agnostic (surface.name, not surface.kind), and
    // the self-gating admin_* views (supabase/migrations/20260717150000_admin_crm.sql
    // §6, 20260719150000_community.sql §4) are exactly as access-controlled as
    // the RPCs — the brief's table covered only functions and left every
    // admin_ view defaulting to "deny" for non-super_admin roles.
    expect(defaultExpectation(view("admin_overview"), "A10")).toBe("allow"); // verifier
    expect(defaultExpectation(view("admin_payments"), "A11")).toBe("allow"); // finance
    expect(defaultExpectation(view("admin_news"), "A12")).toBe("allow"); // editor
    // and the converse: a view scoped to super_admin only stays denied for
    // the other three admin roles even though they pass ADMIN_ACTORS.includes.
    expect(defaultExpectation(view("admin_settings"), "A10")).toBe("deny");
    expect(defaultExpectation(view("admin_settings"), "A11")).toBe("deny");
    expect(defaultExpectation(view("admin_settings"), "A12")).toBe("deny");
  });

  it("keeps super_admin-only surfaces denied to every other admin role", () => {
    // supabase/migrations/20260717150000_admin_crm.sql:830 (admin_grant_role),
    // :863 (admin_revoke_role), :897 (admin_update_setting) — all single-role
    // has_admin_role('super_admin') checks with no has_any_admin_role fallback.
    for (const surface of ["admin_grant_role", "admin_revoke_role", "admin_update_setting"]) {
      for (const actor of ["A10", "A11", "A12"] as const) {
        expect(defaultExpectation(fn(surface), actor)).toBe("deny");
      }
    }
  });
});

describe("defaultExpectation — tables are governed by grants, not the admin_/public_ naming convention", () => {
  // Coordinator-flagged gap (found during Task 2 spec review): admin_roles is
  // a TABLE (supabase/migrations/20260712212409_initial_schema.sql:64), and
  // "admin_roles".startsWith("admin_") is true, so before this fix it fell
  // into the self-gating admin_ branch and defaulted to "deny" for A10-A12 —
  // three confident false findings on designed behaviour, since those actors
  // each hold their own row and the probe would return it. The real rule
  // (supabase/migrations/20260717150000_admin_crm.sql:936-938) is a plain
  // `grant select ... to authenticated` plus an owner-scoping RLS policy:
  // every authenticated actor may run the select at all; RLS decides which
  // rows come back.
  it("allows admin_roles to every authenticated actor and denies it to anonymous", () => {
    for (const actor of [
      "A2",
      "A3",
      "A4",
      "A5",
      "A6",
      "A7",
      "A8",
      "A9",
      "A10",
      "A11",
      "A12",
    ] as const) {
      expect(defaultExpectation(table("admin_roles"), actor)).toBe("allow");
    }
    expect(defaultExpectation(table("admin_roles"), "A1")).toBe("deny");
  });

  it("never applies the admin_ role-family rule to a table, not even for super_admin", () => {
    // A hypothetical table sharing the admin_ prefix but with no
    // KNOWN_TABLE_OVERRIDES entry must NOT inherit an "allow" from the
    // admin_ wildcard the way a same-named function/view would — a table's
    // access can only come from a verified grant, never a guess from its
    // name. Fails closed (rule-derived "deny") pending that verification,
    // same as any other unknown pair.
    expect(defaultExpectation(table("admin_some_future_table"), "A9")).toBe("deny");
    expect(isRuleDerived(table("admin_some_future_table"), "A9")).toBe(true);
  });

  it("never applies the public_ anyone-may-read rule to a table", () => {
    // Symmetric case: no public_-prefixed table exists today (verified by
    // grepping `create table` across every migration), but the same
    // structural reasoning applies — a table isn't auto-opened to anon just
    // because it shares a view's naming convention.
    expect(defaultExpectation(table("public_some_future_table"), "A1")).toBe("deny");
  });

  it("still applies the admin_/public_ conventions normally to functions and views", () => {
    // The kind gate must narrow the branch, not disable it.
    expect(defaultExpectation(fn("admin_record_payment"), "A9")).toBe("allow");
    expect(defaultExpectation(view("public_news"), "A1")).toBe("allow");
  });
});

describe("isRuleDerived", () => {
  it("is true when no override covers the actor", () => {
    expect(isRuleDerived(fn("member_change_tier"), "A3")).toBe(true);
  });

  it("is false when an override states the expectation explicitly", () => {
    expect(isRuleDerived(fn("member_change_tier", { A3: "deny" }), "A3")).toBe(false);
  });
});
