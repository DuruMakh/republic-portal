"use client";

import { TIERS, type Tier } from "@/lib/funnel";

export function TierPicker({ value, onChange }: { value: Tier; onChange: (tier: Tier) => void }) {
  return (
    <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="ყოველთვიური საწევრო">
      {TIERS.map((tier) => {
        const selected = tier === value;
        return (
          <button
            key={tier}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(tier)}
            className={`rounded-xl border-2 p-4 text-center transition-colors ${
              selected ? "border-brand bg-brand/5" : "border-line bg-white hover:border-muted-fg"
            }`}
          >
            <span className="block text-3xl font-extrabold text-ink">
              {tier}
              <small className="text-base font-bold">₾</small>
            </span>
            <span className="mt-1 block text-xs font-semibold text-muted-fg">თვეში</span>
          </button>
        );
      })}
    </div>
  );
}
