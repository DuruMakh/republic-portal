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

/**
 * The „ერთობა“ step bar: a full-width row between two ink rules, a bold condensed Roman numeral
 * per step, the current step underlined in red, finished steps in green.
 */
export function Stepper({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className="m-0 flex list-none border-y-2 border-ink p-0">
      {steps.map((label, i) => {
        const step = i + 1;
        const active = step === current;
        const done = step < current;
        const numeral = active ? "text-brand" : done ? "text-ok-deep" : "text-[#a39684]";
        const text = active ? "text-ink" : done ? "text-ok-deep" : "text-secondary";
        return (
          <li
            key={label}
            className={`relative flex min-w-0 flex-1 items-baseline gap-3 py-3.5 pr-3 md:gap-4 md:py-[18px] md:pr-5 ${
              i > 0 ? "border-l border-rule pl-3.5 md:pl-[22px]" : ""
            }`}
          >
            <span
              aria-current={active ? "step" : undefined}
              className={`text-[28px] font-black leading-none [font-stretch:62.5%] md:text-[34px] ${numeral}`}
            >
              {toRomanNumeral(step)}.
            </span>
            <span className={`text-[14px] font-bold md:text-[15px] ${text}`}>{label}</span>
            {active ? (
              <span aria-hidden="true" className="absolute inset-x-0 -bottom-0.5 h-1 bg-brand" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
