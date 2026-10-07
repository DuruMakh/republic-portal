import Link from "next/link";
import { formatCountKa } from "@/lib/format";
import type { RankedDelegate } from "@/lib/ranking";

// The ranked figure counts every member in a delegate's team (ADR-036: no dues, so no
// "active" tier). app/(public)/page.tsx and app/(member)/me/profile/page.tsx carry the
// same label.
const RANK_FIGURE_LABEL = "წევრი";

/** Printed-index leaderboard row (spec §3.3): medals retired, plain numeral rank,
 * №1 in text-brand -- restyled with IndexRow's class language, but kept as its own
 * component (whole-row link + data-testid="leader-row" stay load-bearing for e2e). */
export function LeaderRow({ delegate }: { delegate: RankedDelegate }) {
  return (
    <Link
      href={`/delegates/${delegate.slug}`}
      data-testid="leader-row"
      className="flex items-baseline gap-3.5 border-b border-hairline px-4 py-3.5 no-underline transition-colors hover:bg-surface sm:px-5"
    >
      <span
        data-testid={`rank-${delegate.rank}`}
        className={`w-7 shrink-0 font-serif font-bold ${delegate.rank === 1 ? "text-brand" : "text-muted-fg"}`}
      >
        {delegate.rank}.
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif font-bold text-ink">
          {delegate.first_name} {delegate.last_name}
        </span>
        <span className="mt-0.5 block text-[0.74rem] tracking-[.06em] text-muted-fg">
          {delegate.region_name_ka}
        </span>
      </span>
      <span className="text-right">
        <span className="block font-serif font-bold tabular-nums text-ink">
          {formatCountKa(delegate.members)}
        </span>
        <span className="block text-[0.74rem] text-muted-fg">{RANK_FIGURE_LABEL}</span>
      </span>
    </Link>
  );
}
