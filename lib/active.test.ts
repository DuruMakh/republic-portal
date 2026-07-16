import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  computeCoverage,
  COVERAGE_DAYS_PER_MONTH,
  DEFAULT_GRACE_DAYS,
  monthsFor,
  type CoveragePayment,
} from "./active";

function pay(
  paidAt: string,
  monthsCovered: number,
  voidedAt: string | null = null,
): CoveragePayment {
  return { paidAt, monthsCovered, voidedAt };
}

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
  it('invalid inputs → 0 (preview shows "—")', () => {
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
});

describe("computeCoverage (spec §2 #1–2 — the owner-approved date examples, verbatim)", () => {
  it("constants match the spec", () => {
    expect(COVERAGE_DAYS_PER_MONTH).toBe(30);
    expect(DEFAULT_GRACE_DAYS).toBe(30);
  });

  it("single monthly payment = active exactly 60 days (spec example 1)", () => {
    // tier 20, pays 20 ₾ on 1 ივლისი → covered through 31 ივლისი → active until 30 აგვისტო
    const r = computeCoverage([pay("2026-07-01", 1)], 30, "2026-07-01");
    expect(r.coverageEnd).toBe("2026-07-31");
    expect(r.activeUntil).toBe("2026-08-30");
    expect(r.isActive).toBe(true);
    expect(computeCoverage([pay("2026-07-01", 1)], 30, "2026-08-30").isActive).toBe(true);
    expect(computeCoverage([pay("2026-07-01", 1)], 30, "2026-08-31").isActive).toBe(false);
  });

  it("60 ₾ on tier 20 → covered through 29 სექტემბერი, active until 29 ოქტომბერი (spec example 2)", () => {
    const r = computeCoverage([pay("2026-07-01", 3)], 30, "2026-07-01");
    expect(r.coverageEnd).toBe("2026-09-29");
    expect(r.activeUntil).toBe("2026-10-29");
  });

  it("payments stack — paying early never wastes days (spec example 3)", () => {
    // 20 ₾ on 1 ივლისი + 20 ₾ on 15 ივლისი → covered through 30 აგვისტო, active until 29 სექტემბერი
    const r = computeCoverage([pay("2026-07-01", 1), pay("2026-07-15", 1)], 30, "2026-07-20");
    expect(r.coverageEnd).toBe("2026-08-30");
    expect(r.activeUntil).toBe("2026-09-29");
  });

  it("a payment after a lapse restarts from its own date, not the stale end", () => {
    const r = computeCoverage([pay("2026-01-01", 1), pay("2026-07-01", 1)], 30, "2026-07-02");
    expect(r.coverageEnd).toBe("2026-07-31");
  });

  it("voided payments are excluded", () => {
    const r = computeCoverage(
      [pay("2026-07-01", 1), pay("2026-07-15", 1, "2026-07-16T10:00:00Z")],
      30,
      "2026-07-20",
    );
    expect(r.coverageEnd).toBe("2026-07-31");
  });

  it("input order does not matter (sorted by paidAt internally)", () => {
    const sorted = computeCoverage([pay("2026-07-01", 1), pay("2026-07-15", 1)], 30, "2026-07-20");
    const shuffled = computeCoverage(
      [pay("2026-07-15", 1), pay("2026-07-01", 1)],
      30,
      "2026-07-20",
    );
    expect(shuffled).toEqual(sorted);
  });

  it("no live payments → inactive, null dates", () => {
    expect(computeCoverage([], 30, "2026-07-01")).toEqual({
      coverageEnd: null,
      activeUntil: null,
      isActive: false,
    });
    expect(
      computeCoverage([pay("2026-07-01", 1, "2026-07-02T00:00:00Z")], 30, "2026-07-03").isActive,
    ).toBe(false);
  });

  it("grace 0 → active exactly through coverage end", () => {
    expect(computeCoverage([pay("2026-07-01", 1)], 0, "2026-07-31").isActive).toBe(true);
    expect(computeCoverage([pay("2026-07-01", 1)], 0, "2026-08-01").isActive).toBe(false);
  });
});
