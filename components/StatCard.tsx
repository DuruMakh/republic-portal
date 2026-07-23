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
    <div className="border-t-2 border-ink pt-3">
      <div
        className={`font-serif text-[2.1rem] font-bold leading-tight ${accent === "brand" ? "text-brand" : "text-ink"}`}
      >
        {value}
      </div>
      <div className="text-[0.74rem] text-muted-fg">{label}</div>
      {sub ? <div className="text-[0.74rem] text-muted-fg mt-0.5">{sub}</div> : null}
    </div>
  );
}
