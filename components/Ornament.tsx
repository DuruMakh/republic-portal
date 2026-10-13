/**
 * The /about motif: a Georgian carved-stone braid, drawn in `currentColor` so the caller picks
 * the token. Strands are ribbons: a wide stroke with a thin groove cut down the middle in the
 * colour of the surface beneath (`groove`), the way a chisel leaves them in stone. Decorative
 * (`aria-hidden`).
 */

type Groove = "paper" | "ink" | "brand" | "paper-bright";

const GROOVE: Record<Groove, string> = {
  paper: "stroke-paper",
  ink: "stroke-ink",
  brand: "stroke-brand",
  "paper-bright": "stroke-paper-bright",
};

// One 32-unit tile of a two-strand interlace. Each strand passes over at one crossing and under
// at the next, so the band reads as woven, not as two overlaid waves.
const TILE = 32;
const TILES = 48; // 1536 units: wider than the 1280px sheet, so the band never runs out.
function strand(x: number, from: number, to: number, x0: number) {
  return `M${x0 + x} ${from}C${x0 + x + 5} ${from} ${x0 + x + 11} ${to} ${x0 + x + 16} ${to}`;
}
const UNDER: string[] = [];
const OVER: string[] = [];
const EYES: number[] = [];
for (let i = 0; i < TILES; i++) {
  const x0 = i * TILE;
  // First half-tile: strand A under, strand B over. Second half: the other way round.
  UNDER.push(strand(0, 5, 17, x0), strand(16, 5, 17, x0));
  OVER.push(strand(0, 17, 5, x0), strand(16, 17, 5, x0));
  EYES.push(x0, x0 + 16);
}
const UNDER_D = UNDER.join("");
const OVER_D = OVER.join("");

export function Braid({
  className = "",
  groove = "paper",
}: {
  className?: string;
  groove?: Groove;
}) {
  const cut = GROOVE[groove];
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${TILE * TILES} 22`}
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      className={`block h-[30px] w-full ${className}`.trim()}
    >
      <path d={UNDER_D} stroke="currentColor" strokeWidth="4.5" />
      <path d={UNDER_D} className={cut} strokeWidth="1.3" />
      <path d={OVER_D} stroke="currentColor" strokeWidth="4.5" />
      <path d={OVER_D} className={cut} strokeWidth="1.3" />
      {EYES.map((x) => (
        <circle key={x} cx={x} cy="11" r="2" fill="currentColor" />
      ))}
    </svg>
  );
}
