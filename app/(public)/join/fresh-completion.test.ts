import { describe, expect, it } from "vitest";
import { clearFreshCompletion, markFreshCompletion, peekFreshCompletion } from "./fresh-completion";

describe("fresh-completion marker", () => {
  it("peek is idempotent until cleared (StrictMode double-render safe)", () => {
    markFreshCompletion();
    expect(peekFreshCompletion()).toBe(true);
    expect(peekFreshCompletion()).toBe(true);
    clearFreshCompletion();
    expect(peekFreshCompletion()).toBe(false);
  });
});
