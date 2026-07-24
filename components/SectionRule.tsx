import type { ReactNode } from "react";

/**
 * Small-caps section label over a 2px ink rule, with an optional right-side
 * action (spec §3.2) — the title+action row later tasks reach for instead of
 * Card's own `header` slot wherever the content is a bare label, not a form.
 *
 * The label is a real heading by default (`as="h2"`) so screen-reader users
 * keep the per-section landmarks the pre-Kronika `Card` titles used to provide;
 * pass `as="h3"` where the section nests under another, or `as="div"` for a
 * purely decorative label that should not appear in the page outline.
 */
export function SectionRule({
  label,
  action,
  as: LabelTag = "h2",
  className = "",
}: {
  label: ReactNode;
  action?: ReactNode;
  as?: "h2" | "h3" | "div";
  className?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between border-b-2 border-ink pb-1.5 ${className}`.trim()}
    >
      <LabelTag className="text-[0.7rem] font-bold uppercase tracking-[.18em]">{label}</LabelTag>
      {action}
    </div>
  );
}
