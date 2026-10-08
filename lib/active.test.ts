import { describe, expect, it } from "vitest";
import { addDaysIso, monthsFor } from "./active";

describe("monthsFor (spec §2 #2)", () => {
  it("exact tier buys one month", () => {
    expect(monthsFor(20, 20)).toBe(1);
    expect(monthsFor(5, 5)).toBe(1);
  });
  it("amount buys whole months, rounded down", () => {
    expect(monthsFor(60, 20)).toBe(3);
    expect(monthsFor(50, 20)).toBe(2);
    expect(monthsFor(30, 20)).toBe(1);
    expect(monthsFor(10, 5)).toBe(2);
  });
  it("underpayment still buys the minimum 1 month", () => {
    expect(monthsFor(5, 20)).toBe(1);
    expect(monthsFor(0.01, 20)).toBe(1);
  });
  it("invalid inputs → 0 (preview shows „—“)", () => {
    expect(monthsFor(0, 20)).toBe(0);
    expect(monthsFor(-5, 20)).toBe(0);
    expect(monthsFor(20, 0)).toBe(0);
    expect(monthsFor(Number.NaN, 20)).toBe(0);
    expect(monthsFor(20, Number.NaN)).toBe(0);
  });
});

describe("addDaysIso", () => {
  it("adds days across month/year boundaries", () => {
    expect(addDaysIso("2026-07-01", 30)).toBe("2026-07-31");
    expect(addDaysIso("2026-12-15", 30)).toBe("2027-01-14");
    expect(addDaysIso("2026-07-31", 0)).toBe("2026-07-31");
  });
  it("throws on malformed input", () => {
    expect(() => addDaysIso("2026-7-1", 30)).toThrow();
  });
});
