export function ballotButtonClasses(state: "solid" | "muted"): string {
  const base =
    "h-10 flex-1 border px-3 text-left text-[0.86rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50";

  if (state === "solid") {
    return `${base} border-ink bg-transparent text-ink hover:bg-ink hover:text-paper`;
  }

  return `${base} border-hairline text-muted-fg hover:border-ink hover:text-ink hover:bg-transparent`;
}

export interface BallotBarProps {
  label: string;
  pct: number;
  tone: "brand" | "ink" | "muted";
}

export function BallotBar({ label, pct, tone }: BallotBarProps) {
  const toneClass = tone === "brand" ? "bg-brand" : tone === "ink" ? "bg-ink" : "bg-muted-fg";

  return (
    <div className="grid grid-cols-[1fr_2fr_auto] items-center gap-3">
      <div className="text-[0.74rem] text-muted-fg">{label}</div>
      <div className="h-2 bg-surface relative">
        <div className={`absolute inset-y-0 left-0 ${toneClass}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="font-serif font-bold text-right">{pct}</div>
    </div>
  );
}
