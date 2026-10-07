import { describe, expect, it } from "vitest";
import {
  COUNCIL_HALF,
  councilLayout,
  seededRandom,
  TALLY_HEIGHT,
  TALLY_WIDTH,
  tallyLayout,
  type PebbleShape,
} from "./pebbles";

const reach = (p: PebbleShape) => Math.max(p.rx, p.ry);

describe("seededRandom", () => {
  it("repeats the same sequence for the same seed, in [0, 1)", () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const xs = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(xs);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("councilLayout", () => {
  it("is identical on every call, so server output never changes between builds", () => {
    expect(councilLayout(5)).toEqual(councilLayout(5));
  });

  it("places one seat per board member and 160 member pebbles by default", () => {
    const { seats, members } = councilLayout(5);
    expect(seats).toHaveLength(5);
    expect(members).toHaveLength(160);
  });

  it("keeps every pebble inside the square viewBox (nothing clipped)", () => {
    const { seats, members } = councilLayout(5);
    for (const p of [...seats, ...members]) {
      expect(Math.abs(p.cx) + reach(p)).toBeLessThanOrEqual(COUNCIL_HALF);
      expect(Math.abs(p.cy) + reach(p)).toBeLessThanOrEqual(COUNCIL_HALF);
    }
  });
});

describe("tallyLayout", () => {
  it("builds two full rectangles: 9x4 for, 6x4 against", () => {
    const t = tallyLayout(9, 6);
    expect(t.for).toHaveLength(36);
    expect(t.against).toHaveLength(24);
  });

  it("keeps the for pile left of the divider and the against pile right of it", () => {
    const t = tallyLayout(9, 6);
    for (const p of t.for) expect(p.cx + reach(p)).toBeLessThan(TALLY_WIDTH / 2);
    for (const p of t.against) expect(p.cx - reach(p)).toBeGreaterThan(TALLY_WIDTH / 2);
  });

  it("keeps every pebble inside the viewBox (the clipped-pile bug)", () => {
    const t = tallyLayout(9, 6);
    for (const p of [...t.for, ...t.against]) {
      expect(p.cx - reach(p)).toBeGreaterThanOrEqual(0);
      expect(p.cx + reach(p)).toBeLessThanOrEqual(TALLY_WIDTH);
      expect(p.cy - reach(p)).toBeGreaterThanOrEqual(0);
      expect(p.cy + reach(p)).toBeLessThanOrEqual(TALLY_HEIGHT);
    }
  });
});
