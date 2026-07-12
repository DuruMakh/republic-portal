const labels = ["კონტაქტი", "პროფილი", "წევრობა"] as const;

export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-4">
      {labels.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
        const active = step === current;
        const done = step < current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                active
                  ? "bg-brand text-white"
                  : done
                    ? "bg-ok text-white"
                    : "bg-surface text-muted-fg"
              }`}
            >
              {step}
            </span>
            <span className={`text-sm ${active ? "font-semibold text-ink" : "text-muted-fg"}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
