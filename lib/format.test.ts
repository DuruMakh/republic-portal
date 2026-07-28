import { describe, expect, it } from "vitest";
import { delegateBioFallback, formatCountKa } from "./format";

describe("formatCountKa", () => {
  it("returns the bare digits with no grouping below 1000", () => {
    expect(formatCountKa(0)).toBe("0");
    expect(formatCountKa(342)).toBe("342");
  });

  it("groups thousands with NBSP (U+00A0), not a regular space", () => {
    // Node's ICU and Chromium's ICU disagree on ka-GE thousands grouping
    // (regular space vs NBSP vs different digit grouping), which caused an
    // SSR/client hydration mismatch in CountUp. formatCountKa must be a pure,
    // deterministic string operation with no Intl/toLocaleString dependency.
    expect(formatCountKa(1636)).toBe("1 636");
    expect(formatCountKa(1000000)).toBe("1 000 000");
  });
});

describe("formatCountKa null/undefined guard", () => {
  it("treats a missing count as zero instead of throwing (fix-list round 2, Fix 2)", () => {
    // An RPC payload read through `as unknown as` with no runtime validation
    // reports referralCount as undefined against a database that predates the
    // migration adding it -- formatCountKa must not throw .toString() on it.
    expect(() => formatCountKa(undefined)).not.toThrow();
    expect(formatCountKa(undefined)).toBe("0");
    expect(formatCountKa(null)).toBe("0");
  });
});

describe("delegateBioFallback", () => {
  it("renders the prototype's generated line for a region", () => {
    expect(delegateBioFallback("იმერეთი")).toBe(
      "იმერეთის რეგიონული დელეგატი. წარმოადგენს ადგილობრივი მოქალაქეების ხმას პლატფორმაზე, აშენებს გუნდს და ანგარიშვალდებულია საკუთარი მხარდამჭერების წინაშე.",
    );
  });

  it.each([
    ["თბილისი", "თბილისის"],
    ["აჭარა", "აჭარის"],
    ["იმერეთი", "იმერეთის"],
    ["კახეთი", "კახეთის"],
    ["ქვემო ქართლი", "ქვემო ქართლის"],
    ["სამეგრელო-ზემო სვანეთი", "სამეგრელო-ზემო სვანეთის"],
    ["სამცხე-ჯავახეთი", "სამცხე-ჯავახეთის"],
    ["გურია", "გურიის"],
    ["მცხეთა-მთიანეთი", "მცხეთა-მთიანეთის"],
    ["რაჭა-ლეჩხუმი და ქვემო სვანეთი", "რაჭა-ლეჩხუმი და ქვემო სვანეთის"],
    ["შიდა ქართლი", "შიდა ქართლის"],
  ])("uses the correct Georgian genitive for %s", (input, expected) => {
    expect(delegateBioFallback(input).startsWith(`${expected} რეგიონული დელეგატი`)).toBe(true);
  });
});
