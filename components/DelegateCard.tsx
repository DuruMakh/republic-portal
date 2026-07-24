import Link from "next/link";
import { Pill } from "@/components/Pill";
import { formatCountKa } from "@/lib/format";
import type { RankedDelegate } from "@/lib/ranking";

// Reused byte-exact from the shipped DelegateCard (git history) -- spliced by
// scripts/task12-inject, never hand-retyped (georgian-quote-transcription-hazard note).
const ACTIVE_SUPPORTER_LABEL = "აქტიური მხარდამჭერი";

/** Numbered registry row (spec §4.2/§3.3 class language) -- the whole row stays ONE
 * link (data-testid="delegate-card" is load-bearing for e2e; see task-12 brief). */
export function DelegateCard({ delegate }: { delegate: RankedDelegate }) {
  return (
    <Link
      href={`/delegates/${delegate.slug}`}
      data-testid="delegate-card"
      className="flex items-baseline gap-3.5 border-b border-hairline py-3.5 no-underline transition-colors hover:bg-surface"
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
      <span className="flex shrink-0 items-baseline gap-3">
        <span className="text-right">
          <span className="block font-serif font-bold tabular-nums text-ink">
            {formatCountKa(delegate.active_supporters)}
          </span>
          <span className="block text-[0.74rem] font-semibold text-muted-fg">
            {ACTIVE_SUPPORTER_LABEL}
          </span>
        </span>
        {/* Approved-status pill is redundant below `sm`: this directory only ever lists
            approved delegates (pending/rejected are filtered server-side), and at the
            360px floor the pill's unbreakable label was the row's overflow driver —
            see e2e/responsive.spec.ts. `lg:` two-column split needs the room back;
            `sm:` and up already have it, matching LeaderRow's narrower row (no pill). */}
        <span className="hidden shrink-0 sm:inline-flex">
          <Pill status="approved" />
        </span>
      </span>
    </Link>
  );
}
