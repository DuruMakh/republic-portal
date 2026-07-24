const ROMAN_NUMERAL_TABLE: ReadonlyArray<readonly [number, string]> = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/**
 * Roman-numeral step furniture by position (spec §3.1) — decorative only.
 * The caller's step label strings are never touched; this only prefixes them.
 */
export function toRomanNumeral(n: number): string {
  let remaining = n;
  let roman = "";
  for (const [value, symbol] of ROMAN_NUMERAL_TABLE) {
    while (remaining >= value) {
      roman += symbol;
      remaining -= value;
    }
  }
  return roman;
}

export function Stepper({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className="flex items-center gap-6 text-sm">
      {steps.map((label, i) => {
        const step = i + 1;
        const active = step === current;
        const done = step < current;
        const stateClasses = active
          ? "text-brand font-bold border-b-2 border-brand pb-0.5"
          : done
            ? "text-ok"
            : "text-muted-fg";
        return (
          <li key={label} className={`flex items-baseline gap-1.5 ${stateClasses}`}>
            <span aria-current={active ? "step" : undefined}>{toRomanNumeral(step)}.</span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
