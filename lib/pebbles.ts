/**
 * Pebble geometry for /structure's two drawings (spec §3). Seeded, so the server renders the
 * same SVG on every build and the client never re-randomises. Coordinates are rounded to one
 * decimal to keep the markup small.
 */
export type PebbleShape = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotate: number;
  opacity: number;
};

/** Park–Miller minimal standard generator: deterministic, values in [0, 1). */
export function seededRandom(seed: number): () => number {
  let s = Math.abs(Math.trunc(seed)) % 2147483647;
  if (s === 0) s = 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The council viewBox is -COUNCIL_HALF..COUNCIL_HALF on both axes. */
export const COUNCIL_HALF = 260;
export const COUNCIL_RING = 84;

export function councilLayout(
  seats: number,
  memberCount = 160,
  seed = 7,
): { seats: PebbleShape[]; members: PebbleShape[] } {
  const r = seededRandom(seed);
  const members = Array.from({ length: memberCount }, () => {
    const angle = r() * Math.PI * 2;
    const distance = 128 + Math.pow(r(), 0.8) * 120;
    const size = 5 + r() * 6;
    return {
      cx: round1(Math.cos(angle) * distance),
      cy: round1(Math.sin(angle) * distance),
      rx: round1(size),
      ry: round1(size * (0.72 + r() * 0.2)),
      rotate: Math.round(r() * 180),
      opacity: round1(0.55 + r() * 0.45),
    };
  });
  const seatShapes = Array.from({ length: seats }, (_, i) => {
    const angle = -Math.PI / 2 + i * ((Math.PI * 2) / seats);
    return {
      cx: round1(Math.cos(angle) * COUNCIL_RING),
      cy: round1(Math.sin(angle) * COUNCIL_RING),
      rx: 27,
      ry: 23,
      rotate: Math.round(r() * 60 - 30),
      opacity: 1,
    };
  });
  return { seats: seatShapes, members };
}

export const TALLY_WIDTH = 600;
export const TALLY_HEIGHT = 130;
export const TALLY_DIVIDER = 300;
const TALLY_GAP = 24;

export function tallyLayout(
  forCols: number,
  againstCols: number,
  rows = 4,
  seed = 19,
): { for: PebbleShape[]; against: PebbleShape[] } {
  const r = seededRandom(seed);
  const pile = (cols: number, dir: 1 | -1): PebbleShape[] => {
    const out: PebbleShape[] = [];
    for (let c = 0; c < cols; c++) {
      for (let row = 0; row < rows; row++) {
        out.push({
          cx: round1(TALLY_DIVIDER + dir * (22 + c * TALLY_GAP) + (r() * 4 - 2)),
          cy: round1(104 - row * TALLY_GAP + (r() * 4 - 2)),
          rx: round1(9 + r() * 1.5),
          ry: round1(7.8 + r() * 1.2),
          rotate: Math.round(r() * 180),
          opacity: 1,
        });
      }
    }
    return out;
  };
  return { for: pile(forCols, -1), against: pile(againstCols, 1) };
}
