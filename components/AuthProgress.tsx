import { useCopy } from "@/lib/i18n/copy";
export type AuthProgressStep = "google" | "phone" | "cabinet";

const STEPS: ReadonlyArray<{ id: AuthProgressStep; number: string; label: string }> = [
  { id: "google", number: "01", label: "Google" },
  { id: "phone", number: "02", label: "ტელეფონი" },
  { id: "cabinet", number: "03", label: "კაბინეტი" },
];

/**
 * The registration step bar („ერთობა“): three columns between 2px ink rules, big condensed
 * numerals, the current step underlined in red, a finished step ticked in green.
 */
export function AuthProgress({ currentStep }: { currentStep: AuthProgressStep }) {
  const t = useCopy();
  const currentIndex = STEPS.findIndex((step) => step.id === currentStep);

  return (
    <ol
      aria-label={t("რეგისტრაციის ნაბიჯები")}
      className="flex list-none border-y-2 border-ink p-0"
    >
      {STEPS.map((step, index) => {
        const state =
          index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";

        return (
          <li
            key={step.id}
            aria-current={state === "current" ? "step" : undefined}
            data-state={state}
            className="group relative flex min-w-0 flex-1 flex-col gap-1 border-l border-rule pb-3 pl-3 pr-1.5 pt-2.5 first:border-l-0 first:pl-0 min-[900px]:flex-row min-[900px]:items-baseline min-[900px]:gap-3.5 min-[900px]:py-[18px] min-[900px]:pl-[22px] min-[900px]:pr-5"
          >
            <span
              aria-hidden="true"
              className="text-[24px] font-black leading-none text-[#a39684] [font-stretch:62.5%] group-data-[state=complete]:text-brand group-data-[state=current]:text-brand min-[900px]:text-[34px]"
            >
              {step.number}
            </span>
            <span className="text-[13px] font-bold leading-[1.3] text-secondary group-data-[state=current]:text-ink min-[900px]:text-[15px]">
              <span>{t(step.label)}</span>
              {state === "complete" ? (
                <span aria-hidden="true" className="text-ok-deep">
                  {" "}
                  ✓
                </span>
              ) : null}
            </span>
            {state === "current" ? (
              <span aria-hidden="true" className="absolute inset-x-0 -bottom-0.5 h-1 bg-brand" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
