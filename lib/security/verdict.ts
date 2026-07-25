import type { Expectation, ProbeOutcome, SurfaceKind, Verdict } from "./types";

/**
 * The only code that means "the caller was turned away by a real privilege
 * check". 42883 (undefined function) and PGRST202 (function absent from
 * PostgREST's schema cache) mean no function/signature by that name was
 * found — and since every surface in the manifest comes from live
 * introspection (Task 3) and therefore definitely exists, a not-found code
 * can only mean OUR call was malformed (wrong argument list, a typo in the
 * probe's argument table — Task 7), never that the app correctly refused the
 * actor. That holds on BOTH sides: on the allow side it obviously isn't a
 * finding, but on the deny side it is not proof of denial either — treating
 * it as "clear" would silently launder a probe defect into a false all-clear
 * on exactly the surfaces this audit exists to check. So only 42501 clears a
 * deny expectation; a not-found code always defers to needs-live-proof,
 * same as any other unexpected error.
 */
const DENIED_BY_PRIVILEGE = "42501";

/**
 * Why this file has to read `outcome.errorMessage` at all, which is unusual
 * for a rule that otherwise only cares about SQLSTATEs:
 *
 * Every `raise exception` in every migration under supabase/migrations/ is
 * bare — none carries a `USING ERRCODE = ...` clause (verified: grepping the
 * whole migrations directory for "errcode" returns zero hits). Postgres's
 * default SQLSTATE for a bare RAISE EXCEPTION is P0001, so all ~340 raises in
 * this schema — role gates and business-rule/validation failures alike —
 * arrive as the exact same code. The only thing that distinguishes "the
 * caller was turned away" from "the caller got in and then something else
 * stopped them" is the literal message text, so judge() has no choice but to
 * read it. Two token allowlists below do that reading — matched by exact
 * string, never a substring sweep, and every entry earned its place by being
 * read, in context, in the migration that raises it (see
 * lib/security/verdict.tokens-drift.test.ts, which re-derives the same
 * tokens from the live migration text so this pair of lists can't silently
 * go stale).
 *
 * REFUSAL_TOKENS: raised as part of the unconditional identity/standing gate
 * every RPC envelope runs before doing anything else (ADR-014) — auth first,
 * then (where relevant) role or standing. A match proves the caller never
 * got in. Confirmed for every occurrence of every token below, not assumed:
 * `not_authenticated` (68 occurrences) is always the literal first statement
 * in the function body; `missing_role` (39, including admin_export_members'
 * second, narrower super_admin-only check) is always the next statement with
 * nothing but `not_authenticated` before it; `not_a_delegate`/`not_approved`
 * (delegate_panel, delegate_team, delegate_team_rsvps) and `not_a_member`
 * (member_change_delegate, request_delegacy) are always caller-standing
 * checks — never about some other row's state — that run before any
 * business logic touches the function's actual payload, even where they
 * aren't literally the second statement. On the deny side all five are
 * equally conclusive (any of them proves the actor didn't get in). On the
 * allow side they are NOT interchangeable — `not_authenticated` is carved
 * out; see NO_SESSION_TOKEN below judge() for why.
 *
 * POST_GATE_TOKENS: every other literal, single-word exception token in the
 * schema — argument validation (invalid_amount, invalid_target, ...) and
 * business-rule refusals (last_super_admin, delegacy_exists, poll_closed,
 * ...). For every RPC that raises one, reaching it is only possible after
 * that RPC's own leading gate has already let the caller through, so for a
 * deny expectation it is proof of the opposite of a refusal — a finding, per
 * the brief's own (previously unenforced) observation that "a validation
 * error proves the caller got past the grant." Two of these — `invalid_name`,
 * `invalid_employment` — are ALSO raised by protect_profile_columns()
 * (20260716140000_cabinet_hardening.sql, latest body
 * 20260721120000_progressive_registration.sql:54), a column-protection
 * TRIGGER with no leading gate of its own (it fires on any client-role
 * UPDATE of profiles, unconditionally on `current_user`, never on
 * `auth.uid()`) — the same reason `delegate_requires_completed_member` is
 * excluded below rather than classified. The classification is unaffected
 * either way: both tokens are validation, not an identity/standing refusal,
 * whichever context raises them.
 *
 * Deliberately left out of both lists, and out of the drift guard's
 * required-classification set: `not_completed` and `profile_incomplete`
 * mean a caller-standing gate in some functions (member_rsvp,
 * member_cast_vote: "is this caller even registered") and an unrelated
 * target/payload validation in others (admin_record_payment: "is the
 * TARGET member's profile complete") — the identical token text carries two
 * different meanings depending on which function raised it, which a
 * message-only match can never disambiguate. Guessing either way risks a
 * false clear or a false finding, so both stay unclassified and any deny-side
 * probe returning them defers to needs-live-proof, same as an unrecognised
 * token. `terms_required` is dead (its only call site, funnel_save_profile,
 * was dropped in 20260721120000_progressive_registration.sql).
 * `delegate_requires_completed_member` belongs to a trigger
 * (enforce_delegate_completed), not an RPC with a caller to refuse or admit.
 * `audit_log is append-only` / `server-managed profile columns cannot be
 * changed by client roles` are full-sentence trigger messages, not tokens.
 */
const RAISE_EXCEPTION_SQLSTATE = "P0001";

/**
 * Exported (not just module-local) so verdict.tokens-drift.test.ts can check
 * these exact sets against the live migration text instead of a hand-copied
 * shadow of them — a drift guard that compared two independently-maintained
 * lists would only prove they agree with EACH OTHER, not with the schema.
 */
export const REFUSAL_TOKENS = new Set([
  "not_authenticated",
  "missing_role",
  "not_a_delegate",
  "not_approved",
  "not_a_member",
]);

export const POST_GATE_TOKENS = new Set([
  "invalid_target",
  "invalid_status",
  "invalid_name",
  "invalid_title",
  "invalid_delegate",
  "invalid_body",
  "duplicate_personal_id",
  "invalid_slug",
  "invalid_role",
  "invalid_tier",
  "invalid_personal_id",
  "invalid_event_dates",
  "invalid_employment",
  "delegacy_exists",
  "rsvp_closed",
  "invalid_setting",
  "invalid_location",
  "last_super_admin",
  "invalid_visibility",
  "invalid_rows",
  "invalid_options",
  "invalid_image",
  "invalid_date",
  "invalid_city",
  "invalid_birth_date",
  "invalid_amount",
  "duplicate_reference",
  "already_completed",
  "poll_closed",
  "invalid_reason",
  "invalid_question",
  "invalid_option",
  "invalid_note",
  "duplicate",
  "already_voted",
  "already_voided",
]);

/**
 * Surfaces you CALL, as opposed to surfaces you READ. The distinction decides
 * what "no error, no rows" means, and it is the difference between finding a
 * privilege-escalation hole and filing it as inconclusive.
 */
const INVOCATION_KINDS = new Set<SurfaceKind>(["function", "action", "endpoint"]);

/**
 * The one REFUSAL_TOKENS entry that is not an authorization verdict.
 * `missing_role`, `not_a_delegate`, `not_approved` and `not_a_member` all
 * mean "this actor was identified and found to lack permission or
 * standing" — a real over-restriction finding when allow was expected.
 * `not_authenticated` means no session was presented at all, which is an
 * infrastructure condition, not a verdict about the actor: Task 1 shipped an
 * on-disk session cache (scripts/security/session-cache.mjs) so a probe's
 * JWT now persists across runs and CAN go stale. One stale cached token
 * would otherwise turn every allow-expected probe for that one actor, across
 * all ~154 surfaces, into a confident "over-restriction" finding at once —
 * a whole actor's column of the census, wrong, and loudly. On the deny side
 * this distinction doesn't matter (presenting no session at all still
 * proves the actor didn't get in, which is all "clear" needs), so
 * `not_authenticated` stays a full REFUSAL_TOKENS member there — it is
 * carved out on the allow side only, in judge() below.
 */
const NO_SESSION_TOKEN = "not_authenticated";

function classifyToken(outcome: ProbeOutcome): "refusal" | "post-gate" | null {
  if (outcome.errorCode !== RAISE_EXCEPTION_SQLSTATE || outcome.errorMessage === null) return null;
  if (REFUSAL_TOKENS.has(outcome.errorMessage)) return "refusal";
  if (POST_GATE_TOKENS.has(outcome.errorMessage)) return "post-gate";
  return null;
}

export function judge(expectation: Expectation, outcome: ProbeOutcome, kind: SurfaceKind): Verdict {
  const { errorCode, rowCount } = outcome;
  const token = classifyToken(outcome);

  if (expectation === "deny") {
    if (errorCode !== null) {
      if (errorCode === DENIED_BY_PRIVILEGE || token === "refusal") return "clear";
      // A post-gate token on a deny-expectation probe is positive proof the
      // caller got PAST the gate — the brief said as much in prose ("a
      // validation error proves the caller got past the grant") and then
      // filed it as inconclusive anyway. It is a finding, not a maybe.
      if (token === "post-gate") return "finding";
      return "needs-live-proof";
    }
    // No error means the grant exists and the caller got through.
    //
    // For an INVOCATION that is the whole story: most definer functions return
    // nothing — they record a payment, approve a delegate, close a poll. If the
    // call completed, the actor performed the act. Waiting for a returned row
    // before calling that a finding would bury the most dangerous class of hole
    // in the inconclusive pile.
    //
    // For a READ, zero rows is genuinely ambiguous: the filter may simply have
    // matched nothing for this actor's data. Pass 4 settles it by giving the
    // actor data that should match (Task 6, Step 2).
    if (INVOCATION_KINDS.has(kind)) return "finding";
    return rowCount > 0 ? "finding" : "needs-live-proof";
  }

  if (errorCode === null) return "clear";
  // Only a privilege denial is a real over-restriction finding — 42501, or
  // (since this schema enforces every role/standing gate at the application
  // level rather than through a per-role GRANT) a refusal token arriving as
  // P0001. But not_authenticated specifically is excluded even though it is
  // a REFUSAL_TOKENS member: it means no session was presented, which is an
  // infrastructure condition (a stale entry in Task 1's on-disk session
  // cache), not an authorization verdict about this actor — see
  // NO_SESSION_TOKEN above for why asserting a finding here would be
  // dangerous. A post-gate token proves nothing about permissions either
  // way: the caller DID get past the gate, exactly as an allow expectation
  // predicts — it just means this probe's specific arguments didn't
  // validate for this actor, which is a fact about the probe's argument
  // table (Task 7), not about who may reach the surface. A missing function
  // or argument mismatch is the same kind of probe defect and must never be
  // reported to the owner as a security finding.
  const isPermissionRefusal = token === "refusal" && outcome.errorMessage !== NO_SESSION_TOKEN;
  if (errorCode === DENIED_BY_PRIVILEGE || isPermissionRefusal) return "finding";

  // A post-gate token on the ALLOW side settles the question this census asks.
  // `allow` predicts exactly one thing — this actor gets PAST the gate — and a
  // post-gate token is proof that they did: the role/standing check admitted
  // them, and a business rule, an argument, or a duplicate stopped them
  // afterwards. That is a fact about the probe's arguments or the row's state,
  // never about who may reach the surface, so the authorization verdict is
  // clear. (The comment above reasoned this out correctly from the start; the
  // code deferred anyway, leaving 67 of Task 7's 74 unresolved function cells
  // stuck on one shared, non-security cause.)
  //
  // The deny side is deliberately untouched: there the same token proves the
  // caller got in when they should not have, which is a finding.
  if (token === "post-gate") return "clear";

  return "needs-live-proof";
}
