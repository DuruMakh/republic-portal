import Link from "next/link";
import { cardSkin } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
import { formatCountKa } from "@/lib/format";
import type { RankedDelegate } from "@/lib/ranking";

export function DelegateCard({ delegate }: { delegate: RankedDelegate }) {
  return (
    <Link
      href={`/delegates/${delegate.slug}`}
      data-testid="delegate-card"
      className={`block ${cardSkin} p-6 transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <Eyebrow>{delegate.region_name_ka}</Eyebrow>
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
