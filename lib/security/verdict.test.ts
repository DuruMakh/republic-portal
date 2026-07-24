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
