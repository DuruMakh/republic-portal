import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { POST_GATE_TOKENS, REFUSAL_TOKENS } from "./verdict";

// This is the one test in lib/security that is not pure: it reads the real
// migrations rather than trusting a hand-copied shadow of them, because a
// "drift guard" that only compared two lists someone wrote by hand would
// prove they agree with each other, never that they agree with the schema.
// Path is import.meta.url-relative (not process.cwd()-relative) so it
// resolves the same way regardless of where the test runner is invoked from.
const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "supabase",
  "migrations",
);

// Mirrors verdict.ts's own account of why these are unclassified — kept
// here, not imported, so this file states its own reasoning independently
// rather than silently trusting verdict.ts's comment never went stale either.
const DELIBERATELY_UNCLASSIFIED = new Set([
  // Ambiguous: a caller-standing gate in member_rsvp/member_cast_vote/
  // member_change_tier/member_change_delegate ("is the CALLER registered"),
  // but a target/payload validation in admin_record_payment/admin_grant_role
  // ("is the TARGET member's profile complete") — same token text, two
  // unrelated meanings depending on which function raised it.
  "not_completed",
  "profile_incomplete",
  // Dead: its only call site, funnel_save_profile, was dropped in
  // 20260721120000_progressive_registration.sql.
  "terms_required",
  // Belongs to a trigger (enforce_delegate_completed), not an RPC with a
  // caller to refuse or admit.
  "delegate_requires_completed_member",
]);

/**
 * Every literal, single-word `raise exception '<token>'` across every
 * migration. The character class requires the quoted content to be exactly
 * `[a-z][a-z0-9_]*` with nothing else before the closing quote — this
 * naturally excludes the two classes of raise that aren't tokens at all:
 * the `bulk_row:%:<reason>` family (format placeholder + a colon, so the
 * match fails before the closing quote) and full-sentence trigger messages
 * like "audit_log is append-only" (a space breaks the match the same way).
 */
function extractExceptionTokens(): ReadonlySet<string> {
  const tokens = new Set<string>();
  for (const file of readdirSync(MIGRATIONS_DIR)) {
    if (!file.endsWith(".sql")) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const match of sql.matchAll(/raise exception '([a-z][a-z0-9_]*)'/g)) {
      const token = match[1];
      if (token !== undefined) tokens.add(token);
    }
  }
  return tokens;
}

describe("verdict.ts token classification vs. the live migrations", () => {
  it("has no token classified as both a refusal and a post-gate failure", () => {
    const overlap = [...REFUSAL_TOKENS].filter((t) => POST_GATE_TOKENS.has(t));
    expect(overlap).toEqual([]);
  });

  it("classifies every exception token the migrations actually raise", () => {
    // Forward direction: a token added to a migration without a matching
    // decision here (REFUSAL, POST_GATE, or an explicitly-reasoned
    // exclusion) fails this test by name, instead of silently defaulting to
    // needs-live-proof and going unnoticed.
    const live = extractExceptionTokens();
    const unclassified = [...live].filter(
      (t) =>
        !REFUSAL_TOKENS.has(t) && !POST_GATE_TOKENS.has(t) && !DELIBERATELY_UNCLASSIFIED.has(t),
    );
    expect(
      unclassified,
      `unclassified exception token(s) found in the migrations: ${unclassified.join(", ")}`,
    ).toEqual([]);
  });

  it("contains no classified token that has since disappeared from the migrations", () => {
    // Reverse direction: catches a stale entry left behind if a migration is
    // ever rewritten before it's applied (house policy is additive-only
    // once applied, but this still guards the case) or a function carrying
    // one of these tokens is dropped, the way funnel_save_profile was.
    const live = extractExceptionTokens();
    const stale = [...REFUSAL_TOKENS, ...POST_GATE_TOKENS].filter((t) => !live.has(t));
    expect(
      stale,
      `token(s) classified here no longer appear in any migration: ${stale.join(", ")}`,
    ).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // The ORDER invariant, not just the classification one.
  //
  // judge()'s allow side now resolves `allow` + a post-gate token to `clear`,
  // on the reasoning that a post-gate token is proof the caller got PAST the
  // gate. That reasoning is only sound while the schema keeps post-gate tokens
  // strictly behind gates — and nothing above enforces it. The three tests
  // above only assert that every live token is classified SOMEWHERE; a future
  // migration that used, say, `invalid_role` as a role gate ("if not
  // has_admin_role(...) then raise exception 'invalid_role'") would keep every
  // one of them green while making judge() clear a caller who never got in.
  //
  // So this pins the invariant itself: in every function the schema defines,
  // every POST_GATE_TOKENS raise must be PRECEDED by a REFUSAL_TOKENS raise.
  // Checked against the last definition of each function (migrations are
  // applied in filename order and `create or replace` means last one wins,
  // which is exactly how Postgres resolves it) — the same
  // read-the-real-thing discipline as extractExceptionTokens() above.
  //
  // Verified once, out of band, that this file agrees with the database it is
  // standing in for: the token sequence extracted here matches `pg_proc.prosrc`
  // for all 54 live functions with zero mismatches (2026-07-26), and the live
  // catalog produces the same single exemption listed below.
  const GATELESS_BY_DESIGN = new Map([
    // A column-protection TRIGGER, not an RPC with a caller to admit or
    // refuse. It fires on any client-role UPDATE of profiles, gating on
    // `current_user` rather than `auth.uid()`, so it has no identity gate to
    // put in front of its two validation raises — and needs none: PostgREST
    // will not route a trigger-returning function at all, and Postgres
    // refuses one outside a trigger context regardless of grant. verdict.ts's
    // POST_GATE_TOKENS comment already carves out this exact pair.
    ["protect_profile_columns", ["invalid_name", "invalid_employment"]],
  ]);

  /** Last definition of each function across the migrations, in apply order. */
  function latestFunctionBodies(): Map<string, string> {
    const bodies = new Map<string, string>();
    for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
      if (!file.endsWith(".sql")) continue;
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const header = /create (?:or replace )?function\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/g;
      for (const match of sql.matchAll(header)) {
        const name = match[1];
        if (name === undefined || match.index === undefined) continue;
        const open = sql.indexOf("$$", match.index);
        if (open < 0) continue;
        const close = sql.indexOf("$$", open + 2);
        if (close < 0) continue;
        bodies.set(name, sql.slice(open + 2, close));
      }
    }
    return bodies;
  }

  it("raises no post-gate token at or before a function's own gate", () => {
    const offenders: string[] = [];
    for (const [name, body] of latestFunctionBodies()) {
      const raises = [...body.matchAll(/raise exception '([a-z][a-z0-9_]*)'/g)].map((m) => ({
        token: m[1] as string,
        at: m.index as number,
      }));
      const gateAt = raises.find((r) => REFUSAL_TOKENS.has(r.token))?.at;
      const exempt = new Set(GATELESS_BY_DESIGN.get(name) ?? []);
      const early = raises.filter(
        (r) =>
          POST_GATE_TOKENS.has(r.token) &&
          !exempt.has(r.token) &&
          (gateAt === undefined || r.at <= gateAt),
      );
      for (const bad of new Set(early.map((e) => e.token))) {
        offenders.push(
          `${name} raises post-gate '${bad}' ` +
            (gateAt === undefined ? "with no refusal-token gate at all" : "at or before its gate"),
        );
      }
    }
    expect(
      offenders,
      "judge() clears `allow` + a post-gate token because such a token proves the caller " +
        "got past the gate. These raises break that: " +
        offenders.join("; "),
    ).toEqual([]);
  });

  it("finds exactly the function count this order invariant was written against", () => {
    // Tripwire, same role as the token-count one below: a new function is
    // welcome, but it should be a deliberate arrival, not a silent one.
    // 54 live + 4 dropped funnel_*; 59 since the security check-up's fix wave
    // added payments_append_only() (L3-2). It needs no GATELESS_BY_DESIGN
    // exemption, unlike protect_profile_columns: it raises a full SENTENCE
    // ("payments are append-only", audit_log_immutable's idiom), never a token,
    // so it carries nothing the gate-order invariant could find misplaced.
    expect(latestFunctionBodies().size).toBe(59);
    expect(GATELESS_BY_DESIGN.size).toBe(1);
  });

  it("finds exactly the token counts this test suite was written against", () => {
    // Not load-bearing on its own (the two tests above are what actually
    // guard against drift) — a tripwire so a change big enough to move
    // these counts gets a human's attention even if every token still
    // happens to land in a valid bucket.
    const live = extractExceptionTokens();
    // 45 -> 46 and 5 -> 6 when the security check-up's fix wave added
    // `phone_required` to register() (F3).
    expect(live.size).toBe(46);
    expect(REFUSAL_TOKENS.size).toBe(6);
    expect(POST_GATE_TOKENS.size).toBe(36);
    expect(DELIBERATELY_UNCLASSIFIED.size).toBe(4);
  });
});
