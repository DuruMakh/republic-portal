"use client";

import { useRef } from "react";
import { TIERS, type Tier } from "@/lib/funnel";

export function TierPicker({ value, onChange }: { value: Tier; onChange: (tier: Tier) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const moveSelection = (from: number, delta: 1 | -1) => {
    const next = (from + delta + TIERS.length) % TIERS.length;
    const tier = TIERS[next];
    if (tier === undefined) return;
    onChange(tier);
    refs.current[next]?.focus();
  };

  return (
    <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="ყოველთვიური საწევრო">
      {TIERS.map((tier, i) => {
        const selected = tier === value;
        return (
          <button
            key={tier}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tier)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                moveSelection(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                moveSelection(i, -1);
              }
            }}
            className={`border bg-paper-bright p-4 text-center transition-colors ${
              selected ? "border-ink" : "border-hairline hover:border-ink"
            }`}
          >
            <span className="block font-serif text-3xl font-bold text-ink">
              {tier}
              <small className="text-lg font-bold">₾</small>
            </span>
            <span className="mt-1 block text-[0.74rem] font-bold text-muted-fg">თვეში</span>
          </button>
        );
      })}
    </div>
  );
}
