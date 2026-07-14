import Link from "next/link";
import { Pill } from "@/components/Pill";
import { formatCountKa } from "@/lib/format";
import type { RankedDelegate } from "@/lib/ranking";

export function DelegateCard({ delegate }: { delegate: RankedDelegate }) {
  return (
    <Link
      href={`/delegates/${delegate.slug}`}
      data-testid="delegate-card"
      className="block rounded-xl border border-line bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="text-xs font-bold uppercase tracking-wide text-brand">
        {delegate.region_name_ka}
      </div>
      <div className="mb-3 mt-1.5 text-lg font-bold text-ink">
        {delegate.first_name} {delegate.last_name}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold tabular-nums text-ink">
            {formatCountKa(delegate.active_supporters)}
          </div>
          <div className="text-xs font-semibold text-muted-fg">აქტიური მხარდამჭერი</div>
        </div>
        <Pill status="approved" />
      </div>
    </Link>
  );
}
