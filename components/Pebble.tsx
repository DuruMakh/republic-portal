import type { ReactNode } from "react";

export type PebbleTone = "brand" | "empty" | "outline";

const TONE: Record<PebbleTone, string> = {
  brand: "bg-brand border-[1.5px] border-brand text-paper",
  empty: "bg-surface border-[1.5px] border-line",
  outline: "bg-paper-bright border-2 border-brand text-brand",
};

/** The irregular pebble shape (/structure motif, ADR-037). Size and rotation come via className. */
export function Pebble({
  tone = "brand",
  className = "",
  children,
}: {
  tone?: PebbleTone;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      className={`pebble inline-grid shrink-0 place-items-center ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
