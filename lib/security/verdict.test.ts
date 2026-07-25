import { describe, expect, it } from "vitest";
import { judge } from "./verdict";
import type { ProbeOutcome, SurfaceKind } from "./types";

const outcome = (o: Partial<ProbeOutcome> = {}): ProbeOutcome => ({
  errorCode: null,
  errorMessage: null,
  rowCount: 0,
  ...o,
});

// Reads (view, table) share identical semantics in judge(): "kind" only
// matters for INVOCATION_KINDS membership, and neither view nor table
// belongs to it. Parametrized over both — rather than hardcoding "view" —
// so a mutation that widened INVOCATION_KINDS to include "table" (which
// would silently turn every deny-expectation table read into a false
// "finding", affecting all 16 tables in the census) fails here instead of
// passing 16 tests unnoticed the way it did when only "view" was exercised.
const READ_KINDS = ["view", "table"] as const satisfies readonly SurfaceKind[];

describe.each(READ_KINDS)("judge — reads (%s)", (kind) => {
  it("clears a denial that returns 42501", () => {
    expect(judge("deny", outcome({ errorCode: "42501" }), kind)).toBe("clear");
  });

  // 42883/PGRST202 mean "no function/signature by that name" — never proof a
  // real privilege check turned the caller away. Since every surface in the
  // manifest comes from live introspection and therefore definitely exists,
  // a not-found code on the deny side always means OUR probe was malformed
  // (Task 7's argument table), so it must defer, not silently clear a hole.
  it("does NOT clear a denial that returns 42883 — a probe defect, not proof of denial", () => {
    expect(judge("deny", outcome({ errorCode: "42883" }), kind)).toBe("needs-live-proof");
  });

  it("does NOT clear a denial that returns PGRST202 — a probe defect, not proof of denial", () => {
    expect(judge("deny", outcome({ errorCode: "PGRST202" }), kind)).toBe("needs-live-proof");
  });

  it("flags a leak when a denial returns rows", () => {
    expect(judge("deny", outcome({ rowCount: 3 }), kind)).toBe("finding");
  });

  it("does NOT clear a read denial that merely returned zero rows", () => {
    expect(judge("deny", outcome({ rowCount: 0 }), kind)).toBe("needs-live-proof");
  });

  it("does NOT treat a validation error as a denial", () => {
    expect(judge("deny", outcome({ errorCode: "22023", errorMessage: "invalid_tier" }), kind)).toBe(
      "needs-live-proof",
    );
  });

  it("clears an allow that succeeds", () => {
    expect(judge("allow", outcome({ rowCount: 5 }), kind)).toBe("clear");
  });

  it("flags an allow that is denied", () => {
    expect(judge("allow", outcome({ errorCode: "42501" }), kind)).toBe("finding");
  });

  it("defers an allow that errors unexpectedly", () => {
    expect(judge("allow", outcome({ errorCode: "22023" }), kind)).toBe("needs-live-proof");
  });

  it("does NOT call a missing-function error a finding — that is a probe defect", () => {
    expect(judge("allow", outcome({ errorCode: "PGRST202" }), kind)).toBe("needs-live-proof");
    expect(judge("allow", outcome({ errorCode: "42883" }), kind)).toBe("needs-live-proof");
  });
});

// This schema never sets an ERRCODE, so every `raise exception` — role gates
// and business-rule/validation failures alike — arrives as P0001. judge()
// disambiguates them by reading the message against two allowlists
// (REFUSAL_TOKENS, POST_GATE_TOKENS — see verdict.ts's file-level comment for
// how each token earned its place, and verdict.tokens-drift.test.ts for the
// guard that keeps them honest against the live migrations). "view" is used
// throughout below since this classification is kind-independent — it lives
// entirely in the errorCode/errorMessage branch, before kind is ever
// consulted.
describe("judge — P0001 token classification (this schema's bare raise exception)", () => {
  it("clears a deny expectation when P0001 carries a refusal token", () => {
    // Two different tokens, to prove this isn't hardcoded to one string.
    expect(
      judge("deny", outcome({ errorCode: "P0001", errorMessage: "missing_role" }), "view"),
    ).toBe("clear");
    expect(
      judge("deny", outcome({ errorCode: "P0001", errorMessage: "not_authenticated" }), "view"),
    ).toBe("clear");
  });

  it("flags a deny expectation as a finding when P0001 carries a post-gate token", () => {
    // The brief said this in prose ("a validation error proves the caller
    // got past the grant") and then filed it as needs-live-proof anyway —
    // this is the fix. Two tokens: a plain argument-validation one and a
    // business-rule one, to prove the allowlist isn't just "invalid_*".
    expect(
      judge("deny", outcome({ errorCode: "P0001", errorMessage: "invalid_target" }), "view"),
    ).toBe("finding");
    expect(
      judge("deny", outcome({ errorCode: "P0001", errorMessage: "last_super_admin" }), "view"),
    ).toBe("finding");
  });

  it("leaves a deny expectation unresolved when P0001 carries an unrecognised token", () => {
    // Never guess in either direction — an unclassified message (a typo, a
    // token from a function this list hasn't caught up with) must not be
    // read as proof of anything.
    expect(
      judge("deny", outcome({ errorCode: "P0001", errorMessage: "some_future_token" }), "view"),
    ).toBe("needs-live-proof");
  });

  it("flags an allow expectation as a finding when P0001 carries a genuine permission-refusal token", () => {
    // Symmetric to 42501: this schema enforces every admin role/standing
    // check at the application level (a bare raise, not a per-role GRANT),
    // so P0001+refusal is the dominant way an allow-expected actor would
    // actually be turned away — without this, that whole class of
    // over-restriction bug would sit in needs-live-proof forever, since
    // 42501 essentially never fires for these functions (every client role
    // holds EXECUTE; the finer-grained role check happens in the body).
    // Three of the four genuine-permission tokens (not just missing_role),
    // to prove this isn't hardcoded to one string — not_authenticated is
    // deliberately excluded from this set; see the next two tests.
    expect(
      judge("allow", outcome({ errorCode: "P0001", errorMessage: "missing_role" }), "view"),
    ).toBe("finding");
    expect(
      judge("allow", outcome({ errorCode: "P0001", errorMessage: "not_a_delegate" }), "view"),
    ).toBe("finding");
    expect(
      judge("allow", outcome({ errorCode: "P0001", errorMessage: "not_a_member" }), "view"),
    ).toBe("finding");
  });

  it("does NOT flag an allow expectation when P0001 carries not_authenticated — infrastructure, not a permission verdict", () => {
    // The one REFUSAL_TOKENS member that is not an authorization verdict:
    // "no session was presented" more plausibly means a stale entry in
    // Task 1's on-disk session cache than a real app bug, and unlike the
    // other four refusal tokens, treating it as a finding here would turn
    // one bad cached JWT into a false "over-restriction" finding across
    // every surface for that actor at once. This is the path that was
    // previously untested — allow + missing_role was pinned above, but
    // allow + not_authenticated never was, which is how the asymmetry
    // shipped unnoticed the first time.
    expect(
      judge("allow", outcome({ errorCode: "P0001", errorMessage: "not_authenticated" }), "view"),
    ).toBe("needs-live-proof");
  });

  it("still clears a deny expectation on not_authenticated — the asymmetry is allow-side only", () => {
    // Restated explicitly (already covered above by the two-token deny
    // test) so the deny/allow split for this one token reads as a pinned
    // contract, not an implication a reader has to derive by cross-
    // referencing two other tests.
    expect(
      judge("deny", outcome({ errorCode: "P0001", errorMessage: "not_authenticated" }), "view"),
    ).toBe("clear");
  });

  it("CLEARS an allow expectation when P0001 carries a post-gate token", () => {
    // Changed 2026-07-26, deliberately. This test previously asserted
    // needs-live-proof, on the reasoning that a post-gate token "proves
    // nothing about permissions either way". The first half of that was
    // right and the conclusion was wrong: the caller DID get past the gate,
    // which is precisely and only what `allow` predicts, so the
    // authorization question this census asks IS answered. What stopped
    // them afterwards — an argument, a business rule, a duplicate row — is
    // a fact about the probe's arguments or the row's state, not about who
    // may reach the surface.
    //
    // Deferring instead left 67 of Task 7's 74 unresolved function cells
    // stuck on one shared, non-security cause, which no amount of live
    // proof could ever settle into a security verdict.
    //
    // The deny side is untouched and still calls this a finding — see the
    // "flags a deny expectation as a finding when P0001 carries a post-gate
    // token" test above. That asymmetry is the whole point: the same
    // evidence means "working as intended" when the actor was supposed to
    // get in, and "they got in when they shouldn't have" when they weren't.
    expect(
      judge("allow", outcome({ errorCode: "P0001", errorMessage: "invalid_target" }), "view"),
    ).toBe("clear");
  });

  it("leaves an allow expectation unresolved when P0001 carries an unrecognised token", () => {
    expect(
      judge("allow", outcome({ errorCode: "P0001", errorMessage: "some_future_token" }), "view"),
    ).toBe("needs-live-proof");
  });

  it("requires the SQLSTATE to actually be P0001 — a matching message under a different code is not a token match", () => {
    // Guards the classifier's own gate: "missing_role" as plain text under
    // some other SQLSTATE (a coincidence, or a different error path
    // entirely) must not be read as this schema's role-gate token.
    expect(
      judge("deny", outcome({ errorCode: "22023", errorMessage: "missing_role" }), "view"),
    ).toBe("needs-live-proof");
  });

  it("does not crash and stays unresolved when P0001 carries no message at all", () => {
    expect(judge("deny", outcome({ errorCode: "P0001", errorMessage: null }), "view")).toBe(
      "needs-live-proof",
    );
  });
});

describe("judge — invocations (function, action, endpoint)", () => {
  // The critical case. Most definer functions return nothing: they DO something.
  // A successful unauthorized call and a correctly-blocked one both come back
  // with no error and no rows, so the read rule above would file the single most
  // dangerous class of hole as merely inconclusive. For an invocation, the
  // absence of an error IS the proof that the caller got through.
  it("flags a denied function that executed without error, even returning nothing", () => {
    expect(judge("deny", outcome({ rowCount: 0 }), "function")).toBe("finding");
  });

  it("flags a denied action that executed without error", () => {
    expect(judge("deny", outcome({ rowCount: 0 }), "action")).toBe("finding");
  });

  it("flags a denied endpoint that responded without error", () => {
    expect(judge("deny", outcome({ rowCount: 0 }), "endpoint")).toBe("finding");
  });

  it("still clears a function that was properly refused", () => {
    expect(judge("deny", outcome({ errorCode: "42501" }), "function")).toBe("clear");
  });

  it("still defers a function whose arguments were wrong", () => {
    // Not-found on the deny side is a probe defect, not proof of a refusal —
    // both sides defer identically now (see the DENIED_BY_PRIVILEGE comment
    // in verdict.ts). The test's name was right when this was written; only
    // the "clear" assertion below it was wrong.
    expect(judge("deny", outcome({ errorCode: "PGRST202" }), "function")).toBe("needs-live-proof");
    expect(judge("allow", outcome({ errorCode: "PGRST202" }), "function")).toBe("needs-live-proof");
  });

  it("clears an allowed function that executed", () => {
    expect(judge("allow", outcome({ rowCount: 0 }), "function")).toBe("clear");
  });
});

describe("judge — allowed caller stopped by a business rule, not by permissions", () => {
  // An `allow` expectation predicts exactly one thing: this actor gets PAST
  // the gate. A post-gate token is proof that they did — the role/standing
  // check admitted them and something downstream (an argument, a business
  // rule, a duplicate) stopped them instead. That is a fact about the probe's
  // arguments or the row's state, never about who may reach the surface, so
  // the authorization question the census asks is answered: clear.
  //
  // Deferring these instead left 67 cells unresolved in Task 7's function
  // census for one shared, non-security reason. The deny side is untouched:
  // there a post-gate token still proves the caller got in when they should
  // not have, which is a finding.
  it("clears an allowed caller who was admitted then hit a business rule", () => {
    expect(
      judge(
        "allow",
        outcome({ errorCode: "P0001", errorMessage: "already_completed" }),
        "function",
      ),
    ).toBe("clear");
    expect(
      judge("allow", outcome({ errorCode: "P0001", errorMessage: "invalid_target" }), "function"),
    ).toBe("clear");
  });

  it("still flags an allowed caller refused on permissions", () => {
    expect(
      judge("allow", outcome({ errorCode: "P0001", errorMessage: "missing_role" }), "function"),
    ).toBe("finding");
    expect(judge("allow", outcome({ errorCode: "42501" }), "function")).toBe("finding");
  });

  it("still treats a post-gate token on the deny side as a finding", () => {
    expect(
      judge("deny", outcome({ errorCode: "P0001", errorMessage: "already_completed" }), "function"),
    ).toBe("finding");
  });

  it("still defers an unrecognised token on the allow side", () => {
    expect(
      judge("allow", outcome({ errorCode: "P0001", errorMessage: "brand_new_token" }), "function"),
    ).toBe("needs-live-proof");
  });
});
