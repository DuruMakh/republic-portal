import { describe, expect, it } from "vitest";
import { toRomanNumeral } from "./Stepper";

describe("toRomanNumeral", () => {
  it.each([
    [1, "I"],
    [2, "II"],
    [3, "III"],
    [4, "IV"],
    [5, "V"],
    [9, "IX"],
    [10, "X"],
  ])("%i -> %s", (n, expected) => {
    expect(toRomanNumeral(n)).toBe(expected);
  });
});
