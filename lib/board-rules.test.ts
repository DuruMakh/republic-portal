import { describe, expect, it } from "vitest";
import { BOARD_SIZE, votesNeeded } from "./board-rules";

describe("votesNeeded", () => {
  it("needs 4 of 5 for a two-thirds decision and 3 of 5 for a simple majority", () => {
    expect(BOARD_SIZE).toBe(5);
    expect(votesNeeded("twoThirds", 5)).toBe(4);
    expect(votesNeeded("majority", 5)).toBe(3);
  });

  it("rounds two-thirds up and majority to more than half for other sizes", () => {
    expect([6, 7, 8, 9].map((n) => votesNeeded("twoThirds", n))).toEqual([4, 5, 6, 6]);
    expect([6, 7, 8, 9].map((n) => votesNeeded("majority", n))).toEqual([4, 4, 5, 5]);
  });

  it("rejects a board size that is not a positive whole number", () => {
    expect(() => votesNeeded("majority", 0)).toThrow(RangeError);
    expect(() => votesNeeded("majority", 2.5)).toThrow(RangeError);
  });
});
