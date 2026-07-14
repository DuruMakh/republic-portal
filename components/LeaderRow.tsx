import Link from "next/link";
import { formatCountKa } from "@/lib/format";
import { medalFor, type RankedDelegate } from "@/lib/ranking";

const rankBox: Record<number, string> = {
  1: "bg-[linear-gradient(150deg,#F4D67A,var(--color-gold))] text-[#5a4410]",
  2: "bg-[linear-gradient(150deg,#E7EAF0,#B9C0CC)] text-[#3a4150]",
  3: "bg-[linear-gradient(150deg,#E8C4A0,#C08653)] text-[#4a2f18]",
};

export function LeaderRow({ delegate }: { delegate: RankedDelegate }) {
  const medal = medalFor(delegate.rank);
  return (
    <Link
      href={`/delegates/${delegate.slug}`}
      data-testid="leader-row"
      className="flex items-center gap-4 bg-white px-4 py-3.5 transition-colors hover:bg-surface sm:px-5"
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-extrabold ${
          rankBox[delegate.rank] ?? "bg-surface text-muted-fg"
        }`}
      >
        {medal ?? delegate.rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold text-ink">
          {delegate.first_name} {delegate.last_name}
        </span>
        <span className="block text-sm text-muted-fg">{delegate.region_name_ka}</span>
      </span>
      <span className="text-right">
        <span className="block text-lg font-extrabold tabular-nums text-ink">
          {formatCountKa(delegate.active_supporters)}
        </span>
        <span className="block text-[11px] font-semibold text-muted-fg">მხარდამჭერი</span>
      </span>
    </Link>
  );
}
