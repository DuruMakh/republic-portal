export function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-6 text-center shadow-sm">
      <div className="text-4xl font-bold text-brand">{value}</div>
      <div className="mt-1 text-sm text-muted-fg">{label}</div>
    </div>
  );
}
