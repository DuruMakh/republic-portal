import { describe, expect, it } from "vitest";
import { delegateBioFallback, formatCountKa } from "./format";

describe("formatCountKa", () => {
  it("formats with ka-GE locale grouping", () => {
    expect(formatCountKa(342)).toBe((342).toLocaleString("ka-GE"));
    expect(formatCountKa(1636)).toBe((1636).toLocaleString("ka-GE"));
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
