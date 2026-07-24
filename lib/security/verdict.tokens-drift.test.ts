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

  it("finds exactly the token counts this test suite was written against", () => {
    // Not load-bearing on its own (the two tests above are what actually
    // guard against drift) — a tripwire so a change big enough to move
    // these counts gets a human's attention even if every token still
    // happens to land in a valid bucket.
    const live = extractExceptionTokens();
    expect(live.size).toBe(45);
    expect(REFUSAL_TOKENS.size).toBe(5);
    expect(POST_GATE_TOKENS.size).toBe(36);
    expect(DELIBERATELY_UNCLASSIFIED.size).toBe(4);
  });
});
