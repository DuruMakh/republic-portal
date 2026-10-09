import type { ReactNode } from "react";

export type PebbleTone = "brand" | "empty" | "outline" | "teal" | "teal-outline";

const TONE: Record<PebbleTone, string> = {
  brand: "bg-brand border-[1.5px] border-brand text-paper",
  empty: "bg-surface border-[1.5px] border-line",
  outline: "bg-paper-bright border-2 border-brand text-brand",
  // ADR-048: /structure's illustrations are information, so they are teal.
  teal: "bg-teal border-[1.5px] border-teal text-paper",
  "teal-outline": "bg-paper-bright border-2 border-teal text-teal",
};

/** The irregular pebble shape (/structure motif, ADR-038). Size and rotation come via className. */
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
