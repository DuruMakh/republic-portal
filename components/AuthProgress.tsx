export type AuthProgressStep = "google" | "phone" | "cabinet";

const STEPS: ReadonlyArray<{ id: AuthProgressStep; number: string; label: string }> = [
  { id: "google", number: "01", label: "Google" },
  { id: "phone", number: "02", label: "ტელეფონი" },
  { id: "cabinet", number: "03", label: "კაბინეტი" },
];

export function AuthProgress({ currentStep }: { currentStep: AuthProgressStep }) {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStep);

  return (
    <ol aria-label="რეგისტრაციის ნაბიჯები" className="grid grid-cols-3 border-y border-ink">
      {STEPS.map((step, index) => {
        const state =
          index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";

        return (
          <li
            key={step.id}
            aria-current={state === "current" ? "step" : undefined}
            data-state={state}
            className="group flex min-w-0 items-center gap-1.5 border-r border-hairline px-2 py-3 last:border-r-0 sm:gap-3 sm:px-4"
          >
            <span className="font-serif text-[0.76rem] font-bold text-brand">{step.number}</span>
            <span className="min-w-0 text-[0.68rem] font-bold leading-4 tracking-[.01em] text-muted-fg group-data-[state=current]:text-ink sm:text-[0.8rem] sm:tracking-[.04em]">
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
