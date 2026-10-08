/** The board's size as the approved page text states it (spec §2). */
export const BOARD_SIZE = 5;

export type DecisionRule = "twoThirds" | "majority";

/**
 * Minimum supporting votes among `size` board members.
 * twoThirds: "არანაკლებ 2/3" — at least two thirds, so round up.
 * majority: simple majority of all members — more than half.
 */
export function votesNeeded(rule: DecisionRule, size: number): number {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`invalid board size: ${size}`);
  return rule === "twoThirds" ? Math.ceil((2 * size) / 3) : Math.floor(size / 2) + 1;
}
