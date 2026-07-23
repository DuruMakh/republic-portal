import type { ReactNode } from "react";

/**
 * Small-caps section label over a 2px ink rule, with an optional right-side
 * action (spec §3.2) — the title+action row later tasks reach for instead of
 * Card's own `header` slot wherever the content is a bare label, not a form.
 */
export function SectionRule({
  label,
  action,
  className = "",
}: {
  label: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between border-b-2 border-ink pb-1.5 ${className}`.trim()}
    >
      <div className="text-[0.7rem] font-bold uppercase tracking-[.18em]">{label}</div>
      {action}
    </div>
  );
}
