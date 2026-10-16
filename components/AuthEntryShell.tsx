import type { ReactNode } from "react";
import { UnityKicker } from "./UnityKicker";

/**
 * The join and login screens in the owner's „ერთობა“ redesign: optional step bar, a kicker, the
 * big display headline, an intro, then the action under a 2px ink rule. Beside it (below it on
 * phones) sits the explanatory note: a wine panel with the dark map pattern on wide screens, a
 * plain ruled block on phones. `compact` is the phone step: same frame, no intro.
 */
export function AuthEntryShell({
  eyebrow,
  title,
  intro,
  progress,
  children,
  asideTitle,
  aside,
  compact = false,
}: {
  eyebrow: string;
  title: ReactNode;
  intro: ReactNode;
  progress?: ReactNode;
  children: ReactNode;
  asideTitle: ReactNode;
  aside: ReactNode;
  compact?: boolean;
}) {
  return (
    <main
      aria-labelledby="auth-entry-title"
      className="unity-container pb-12 pt-5 min-[900px]:pb-[clamp(96px,9vw,136px)] min-[900px]:pt-[clamp(40px,4vw,56px)]"
    >
      {progress}
      <div
        className={`grid items-start gap-11 min-[900px]:grid-cols-[minmax(0,1fr)_420px] min-[900px]:gap-[clamp(40px,6vw,96px)] ${
          progress ? "mt-8 min-[900px]:mt-[clamp(48px,5vw,72px)]" : "mt-5 min-[900px]:mt-0"
        }`}
      >
        <section className="min-w-0 max-w-[680px]">
          <UnityKicker>{eyebrow}</UnityKicker>
          <h1
            id="auth-entry-title"
            className="mt-4 font-display text-[56px] font-bold leading-[.92] tracking-[-.005em] min-[900px]:mt-6 min-[900px]:text-[clamp(64px,7vw,104px)]"
          >
            {title}
          </h1>
          {compact ? null : (
            <p className="mt-4 max-w-[30em] font-serif text-[18px] leading-[1.55] text-prose min-[900px]:mt-6 min-[900px]:text-[22px]">
              {intro}
            </p>
          )}
          <div
            className={`border-t-2 border-ink pt-6 min-[900px]:pt-10 ${
              compact ? "mt-7 min-[900px]:mt-11" : "mt-7 min-[900px]:mt-12"
            }`}
          >
            {children}
          </div>
        </section>
        <aside
          aria-labelledby="auth-aside-title"
          className="relative min-w-0 overflow-hidden border-t border-rule pt-7 min-[900px]:border-t-0 min-[900px]:bg-wine min-[900px]:px-11 min-[900px]:pb-[120px] min-[900px]:pt-11 min-[900px]:text-limestone"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative pattern, fixed art */}
          <img
            src="/unity/map-dots-dark.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-10 left-1/2 hidden w-[760px] max-w-none -translate-x-1/2 min-[900px]:block"
          />
          <div className="relative">
            <h2
              id="auth-aside-title"
              className="font-serif text-[22px] font-semibold leading-[1.3] min-[900px]:text-[26px] min-[900px]:text-limestone"
            >
              {asideTitle}
            </h2>
            <div className="mt-4 text-[16px] leading-[1.6] min-[900px]:text-[17px]">{aside}</div>
          </div>
        </aside>
      </div>
    </main>
  );
}

/**
 * The "how it works" steps inside the side note: two-digit condensed numerals joined by a dashed
 * line. `highlight` is the step that matters most (becoming a supporter): red on phones, white on
 * the wine panel.
 */
export function AuthAsideSteps({ steps, highlight }: { steps: string[]; highlight?: number }) {
  return (
    <ol className="mt-6 list-none p-0 min-[900px]:mt-[30px]">
      {steps.map((step, index) => {
        const strong = index === highlight;
        const last = index === steps.length - 1;
        return (
          <li
            key={step}
            className={`relative grid grid-cols-[40px_minmax(0,1fr)] gap-4 ${last ? "" : "pb-[26px]"}`}
          >
            {last ? null : (
              <span
                aria-hidden="true"
                className="absolute bottom-1 left-[19px] top-[34px] border-l-2 border-dashed border-[#cfc4b3] min-[900px]:border-sand/35"
              />
            )}
            <span
              aria-hidden="true"
              className={`text-center text-[28px] font-black leading-none [font-stretch:62.5%] ${
                strong ? "text-brand min-[900px]:text-white" : "text-teal min-[900px]:text-sand"
              }`}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span
              className={`pt-[3px] text-[16px] leading-[1.55] min-[900px]:text-[16.5px] ${
                strong ? "min-[900px]:text-white" : "min-[900px]:text-limestone"
              }`}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
