import { describe, expect, it } from "vitest";
import { judge } from "./verdict";
import type { ProbeOutcome } from "./types";

const outcome = (o: Partial<ProbeOutcome> = {}): ProbeOutcome => ({
  errorCode: null,
  errorMessage: null,
  rowCount: 0,
  ...o,
});

describe("judge — reads (view, table)", () => {
  it("clears a denial that returns 42501", () => {
    expect(judge("deny", outcome({ errorCode: "42501" }), "view")).toBe("clear");
  });

  it("clears a denial that returns 42883", () => {
    expect(judge("deny", outcome({ errorCode: "42883" }), "view")).toBe("clear");
  });

  it("clears a denial that returns PGRST202", () => {
    expect(judge("deny", outcome({ errorCode: "PGRST202" }), "view")).toBe("clear");
  });

  it("flags a leak when a denial returns rows", () => {
    expect(judge("deny", outcome({ rowCount: 3 }), "view")).toBe("finding");
  });

  it("does NOT clear a read denial that merely returned zero rows", () => {
    expect(judge("deny", outcome({ rowCount: 0 }), "view")).toBe("needs-live-proof");
  });

  it("does NOT treat a validation error as a denial", () => {
    expect(
      judge("deny", outcome({ errorCode: "22023", errorMessage: "invalid_tier" }), "view"),
    ).toBe("needs-live-proof");
  });

  it("clears an allow that succeeds", () => {
    expect(judge("allow", outcome({ rowCount: 5 }), "view")).toBe("clear");
  });

  it("flags an allow that is denied", () => {
    expect(judge("allow", outcome({ errorCode: "42501" }), "view")).toBe("finding");
  });

  it("defers an allow that errors unexpectedly", () => {
    expect(judge("allow", outcome({ errorCode: "22023" }), "view")).toBe("needs-live-proof");
  });

  it("does NOT call a missing-function error a finding — that is a probe defect", () => {
    expect(judge("allow", outcome({ errorCode: "PGRST202" }), "view")).toBe("needs-live-proof");
    expect(judge("allow", outcome({ errorCode: "42883" }), "view")).toBe("needs-live-proof");
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
    expect(judge("deny", outcome({ errorCode: "PGRST202" }), "function")).toBe("clear");
    expect(judge("allow", outcome({ errorCode: "PGRST202" }), "function")).toBe("needs-live-proof");
  });

  it("clears an allowed function that executed", () => {
    expect(judge("allow", outcome({ rowCount: 0 }), "function")).toBe("clear");
  });
});
