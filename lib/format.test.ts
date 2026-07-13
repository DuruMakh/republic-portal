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
      "იმერეთის რეგიონული დელეგატი. წარმოადგენს ადგილობრივი მოქალაქეების ხმას პლატფორმაზე, აშენებს გუნდს და ანგარიშვალდებულია საკუთარი მხარდამჭერების წინაშე."
    );
  });
});
