import { votesLabel } from "@/lib/structure-copy";
import { Pebble } from "./Pebble";

// Static class strings so Tailwind generates them; index-matched to the pebbles.
const TILT = ["", "rotate-[25deg]", "", "-rotate-[30deg]", "rotate-[60deg]"];

export function DecisionRuleCard({
  headline,
  body,
  needed,
  total,
}: {
  headline: string;
  body: string;
  needed: number;
  total: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border border-line bg-paper-bright px-5 py-4">
      <div className="max-w-[22em] font-serif text-[1.02rem] leading-snug text-ink">
        <b className="display-heading mb-0.5 block text-[1.5rem] text-brand">{headline}</b>
        <span>{body}</span>
      </div>
      <div
        role="img"
        aria-label={votesLabel(needed, total)}
        className="flex items-center gap-[7px]"
      >
        {Array.from({ length: total }, (_, i) => (
          <Pebble
            key={i}
            tone={i < needed ? "teal" : "empty"}
            className={`h-[26px] w-[30px] ${TILT[i % TILT.length]}`}
          />
        ))}
      </div>
    </div>
  );
}
