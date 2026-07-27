import type { ActorId, Expectation, Surface, SurfaceKind } from "./types";

const ADMIN_ACTORS: readonly ActorId[] = ["A9", "A10", "A11", "A12"];

/**
 * The admin_/public_ naming conventions below describe how self-gating
 * functions and views work: the surface itself checks the caller
 * (has_admin_role/has_any_admin_role) or is filtered to data that's safe for
 * anyone. Tables are governed by an entirely different mechanism — GRANT
 * plus row-level security — so a table that merely SHARES a name prefix
 * (admin_roles today; conceivably a public_ table later) must never be swept
 * into either naming-convention branch. Confirmed by grepping `create table`
 * across every migration: admin_roles is the only admin_-prefixed table
 * among the schema's 16, and no public_-prefixed table exists at all — but
 * the gate is structural (by kind), not a name exclusion, so it holds even
 * if that changes.
 */
const SELF_GATING_KINDS = new Set<SurfaceKind>(["function", "view"]);

/**
 * Known, verified access facts for TABLES whose grant isn't derivable from
 * the admin_/public_ naming conventions — as opposed to ROLE_FAMILIES below,
 * which only describes self-gating functions/views. Each entry here is read
 * directly off a specific migration's GRANT + RLS policy, not inferred from
 * the name. Shaped like Surface["overrides"] so a missing actor key still
 * falls through to the fail-closed placeholder at the end of
 * defaultExpectation, exactly like any other unstated pair.
 */
const KNOWN_TABLE_OVERRIDES: Readonly<
  Partial<Record<string, Readonly<Partial<Record<ActorId, Expectation>>>>>
> = {
  // admin_roles (supabase/migrations/20260712212409_initial_schema.sql:64):
  // `grant select on admin_roles to authenticated` plus the "own admin roles
  // readable" RLS policy (`for select using (auth.uid() = user_id)`) —
  // supabase/migrations/20260717150000_admin_crm.sql:936-938. Every
  // authenticated actor may run the SELECT; RLS alone decides which rows
  // come back (can an actor see a row that isn't theirs?), which is a
  // data-level question Task 6 owns, not something this rule can express.
  // A1 (anon) gets no entry: there is no grant to anon anywhere for this
  // table, so it correctly falls through to the fail-closed "deny" below.
  admin_roles: {
    A2: "allow",
    A3: "allow",
    A4: "allow",
    A5: "allow",
    A6: "allow",
    A7: "allow",
    A8: "allow",
    A9: "allow",
    A10: "allow",
    A11: "allow",
    A12: "allow",
  },
};

/**
 * Which admin roles may reach which admin_-prefixed surfaces. super_admin
 * reaches all of them (the "admin_" wildcard below), which is true for every
 * single admin_ function and view in the schema — every gate is either
 * `has_admin_role('super_admin')` alone or `has_any_admin_role('super_admin',
 * ...)`.
 *
 * Verified against every `has_admin_role` / `has_any_admin_role` check in
 * supabase/migrations/20260717150000_admin_crm.sql,
 * 20260718100000_admin_crm_hardening.sql, 20260719150000_community.sql,
 * 20260721120000_progressive_registration.sql and
 * 20260722120000_r2_ladder_and_numbers.sql (the later R2 migrations —
 * 20260722130000, 20260722140000 — replace function bodies but never touch a
 * role check). The starting table in the task brief was corrected in several
 * places; see task-2-report.md for the full evidence trail. In short:
 *
 *   - admin_reveal_personal_id is super_admin-ONLY (single-role check, no
 *     has_any_admin_role fallback) — it does NOT share verifier's grant on
 *     admin_reveal_applicant_personal_id despite the common "admin_reveal_"
 *     text. A shared prefix here would have wrongly allowed verifier to pull
 *     any member's personal ID, not just an applicant's.
 *   - admin_reassign_member belongs to verifier, not finance.
 *   - admin_update_delegate_profile (verifier), admin_void_payment and
 *     admin_export_members (finance), admin_unpublish_news and
 *     admin_set_news_image (editor) were missing from the brief entirely.
 *   - The self-gating admin_ VIEWS (admin_overview, admin_payments,
 *     admin_news, etc.) were absent from the brief's table, which only listed
 *     functions. defaultExpectation's "admin_" rule is name-based, not
 *     kind-based, so every one of those views needs its own entry or it
 *     silently defaults to "deny" for the roles the migration actually grants
 *     SELECT to.
 *
 * Full surface names are used as entries (not short hand-picked prefixes) so
 * that `.startsWith()` below behaves as an exact match for every entry except
 * the deliberate "admin_" wildcard for super_admin — this is what prevents
 * the admin_reveal_ collision described above from recurring by accident.
 */
const ROLE_FAMILIES: Readonly<Record<ActorId, readonly string[]>> = {
  A9: ["admin_"],
  // verifier — delegate verification and applicant PID reveals (spec §2.1).
  A10: [
    "admin_overview",
    "admin_region_stats",
    "admin_members",
    "admin_delegate_queue",
    "admin_approve_delegate",
    "admin_reject_delegate",
    "admin_update_delegate_profile",
    "admin_reassign_member",
    "admin_reveal_applicant_personal_id",
  ],
  // finance — payments only (spec §2.1).
  A11: [
    "admin_overview",
    "admin_region_stats",
    "admin_members",
    "admin_payments",
    "admin_finance_stats",
    "admin_record_payment",
    "admin_record_payments_bulk",
    "admin_void_payment",
    "admin_export_members",
  ],
  // editor — news, events, polls only (spec §2.1).
  A12: [
    "admin_news",
    "admin_events",
    "admin_polls",
    "admin_poll_options",
    "admin_save_news",
    "admin_publish_news",
    "admin_unpublish_news",
    "admin_delete_news",
    "admin_set_news_image",
    "admin_save_event",
    "admin_publish_event",
    "admin_cancel_event",
    "admin_delete_event",
    "admin_save_poll",
    "admin_open_poll",
    "admin_close_poll",
    "admin_delete_poll",
  ],
  A1: [],
  A2: [],
  A3: [],
  A4: [],
  A5: [],
  A6: [],
  A7: [],
  A8: [],
};

export function isRuleDerived(surface: Surface, actor: ActorId): boolean {
  return surface.overrides?.[actor] === undefined;
}

export function defaultExpectation(surface: Surface, actor: ActorId): Expectation {
  const override = surface.overrides?.[actor];
  if (override !== undefined) return override;

  if (surface.kind === "table") {
    const known = KNOWN_TABLE_OVERRIDES[surface.name]?.[actor];
    if (known !== undefined) return known;
  }

  // Gated to function/view — see SELF_GATING_KINDS above for why tables must
  // never reach either naming-convention branch below, even when the name
  // matches.
  if (SELF_GATING_KINDS.has(surface.kind)) {
    if (surface.name.startsWith("admin_")) {
      if (!ADMIN_ACTORS.includes(actor)) return "deny";
      return ROLE_FAMILIES[actor].some((prefix) => surface.name.startsWith(prefix))
        ? "allow"
        : "deny";
    }

    if (surface.name.startsWith("public_")) return "allow";
  }

  // Everything else is member/delegate machinery — plus any table (admin_- or
  // public_-named or not) with no KNOWN_TABLE_OVERRIDES entry above. The rule
  // cannot know which standings may reach it, so it fails CLOSED: every such
  // pair is reported as rule-derived, and Tasks 6 and 7 must replace it with a
  // stated expectation read from the migration. A "deny" here is a
  // placeholder, not a judgement.
  return "deny";
}
