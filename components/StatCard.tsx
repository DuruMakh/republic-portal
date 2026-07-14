export function StatCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: number | string;
  accent?: "brand";
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-6 text-center shadow-sm">
      <div className={`text-4xl font-bold ${accent === "brand" ? "text-brand" : "text-ink"}`}>
        {value}
      </div>
      <div className="mt-1 text-sm text-muted-fg">{label}</div>
      {sub ? <div className="mt-2 text-xs font-bold text-ok">{sub}</div> : null}
    </div>
  );
}
