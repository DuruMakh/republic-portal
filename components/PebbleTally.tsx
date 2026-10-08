import {
  TALLY_DIVIDER,
  TALLY_HEIGHT,
  TALLY_WIDTH,
  tallyLayout,
  type PebbleShape,
} from "@/lib/pebbles";
import { Pebble } from "./Pebble";

const shape = (p: PebbleShape, className: string, key: string) => (
  <ellipse
    key={key}
    cx={p.cx}
    cy={p.cy}
    rx={p.rx}
    ry={p.ry}
    transform={`rotate(${p.rotate} ${p.cx} ${p.cy})`}
    className={className}
  />
);

/** Illustrative general vote (spec §3.5): for pile wider than against pile. No numbers. */
export function PebbleTally({
  forLabel,
  againstLabel,
}: {
  forLabel: string;
  againstLabel: string;
}) {
  const t = tallyLayout(9, 6);
  return (
    <div className="border border-line bg-paper-bright px-5 py-[18px]">
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${TALLY_WIDTH} ${TALLY_HEIGHT}`}
        className="mx-auto block h-auto w-full max-w-[640px]"
      >
        <line
          x1={TALLY_DIVIDER}
          x2={TALLY_DIVIDER}
          y1={8}
          y2={TALLY_HEIGHT - 8}
          strokeDasharray="3 6"
          className="stroke-line"
        />
        {t.for.map((p, i) => shape(p, "fill-brand", `f${i}`))}
        {t.against.map((p, i) => shape(p, "fill-line", `a${i}`))}
      </svg>
      <div className="mt-3.5 flex flex-wrap justify-between gap-3 text-[0.85rem] text-muted-fg">
        <span className="inline-flex items-center gap-2">
          <Pebble className="h-[11px] w-3" />
          {forLabel}
        </span>
        <span className="inline-flex items-center gap-2">
          {/* Swatch matches the svg's line-coloured pebbles exactly. */}
          <span aria-hidden="true" className="pebble inline-block h-[11px] w-3 bg-line" />
          {againstLabel}
        </span>
      </div>
    </div>
  );
}
