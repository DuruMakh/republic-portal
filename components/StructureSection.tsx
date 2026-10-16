import type { ReactNode } from "react";
import { PEBBLE_ALT, StructurePebble } from "@/components/StructurePebble";
import { Caps } from "@/components/Caps";

/**
 * One ruled /structure section (board, members, general vote): the big headline and lede, with
 * the section's outline letter at the right on wide screens, then the section's content.
 */
export function StructureSection({
  id,
  title,
  lede,
  letter,
  ruled = true,
  wideLede = false,
  children,
}: {
  id: string;
  title: string;
  lede: string;
  letter: string;
  ruled?: boolean;
  /** The vote lede runs a little wider (34em) than the others (32em), as in the design. */
  wideLede?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-6 py-[52px] sm:py-[clamp(72px,8vw,120px)] ${ruled ? "border-t border-rule" : ""}`}
    >
      <div className="unity-container">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div className="min-w-0 flex-[1_1_520px]">
            <h2
              id={`${id}-title`}
              className="m-0 font-display text-[44px] leading-[.95] font-bold sm:text-[clamp(44px,5.5vw,80px)]"
            >
              {title}
            </h2>
            <p
              className={`mt-3.5 font-serif ${wideLede ? "max-w-[34em]" : "max-w-[32em]"} text-[18px] leading-[1.55] text-prose sm:mt-[18px] sm:text-[clamp(19px,1.6vw,22px)]`}
            >
              {lede}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="hidden font-serif text-[clamp(64px,8vw,112px)] leading-[.8] font-extrabold text-transparent [-webkit-text-stroke:1.5px_#CFC4B3] min-[901px]:block"
          >
            {letter}
          </span>
        </div>
        {children}
      </div>
    </section>
  );
}

/** Two columns side by side once both fit at 420px, else stacked. */
export function StructureColumns({ children }: { children: ReactNode }) {
  return (
    <div className="mt-[30px] grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] gap-[34px] sm:mt-[clamp(40px,4.5vw,64px)] sm:gap-[clamp(32px,4vw,64px)]">
      {children}
    </div>
  );
}

/** The small grey capitals above a list or the rule cards. */
export function StructureLabel({ children }: { children: string }) {
  return (
    <div className="text-[12px] font-bold tracking-[.14em] text-secondary sm:text-[13px]">
      <Caps>{children}</Caps>
    </div>
  );
}

/** A labelled list under an ink rule, each line led by a small teal pebble. */
export function StructureBulletList({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div className="min-w-0">
      <StructureLabel>{label}</StructureLabel>
      <ul className="mt-3 border-t-2 border-ink sm:mt-4">
        {items.map((item, i) => (
          <li
            key={item}
            className="grid grid-cols-[22px_minmax(0,1fr)] items-baseline gap-3 border-b border-rule py-3.5 font-serif text-[17px] leading-normal sm:grid-cols-[24px_minmax(0,1fr)] sm:gap-3.5 sm:py-4 sm:text-[19px]"
          >
            <StructurePebble
              alt={i % 2 === 1}
              className={`h-[9px] w-3 bg-teal sm:h-2.5 sm:w-[13px] ${i % 2 ? "rotate-[40deg]" : ""}`}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** How one becomes a member: numbered pebbles joined by a rule, the last one filled. */
export function StructureSteps({ label, steps }: { label: string; steps: readonly string[] }) {
  return (
    <div className="min-w-0">
      <StructureLabel>{label}</StructureLabel>
      <ol className="mt-[18px] sm:mt-[22px]">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <li
              key={step}
              className={`relative grid grid-cols-[46px_minmax(0,1fr)] items-center gap-3.5 sm:grid-cols-[52px_minmax(0,1fr)] sm:gap-[18px] ${last ? "" : "pb-6 sm:pb-[30px]"}`}
            >
              {last ? null : (
                <span
                  aria-hidden="true"
                  className="absolute top-9 bottom-0 left-[22px] border-l-2 border-rule sm:top-10 sm:left-[25px]"
                />
              )}
              <span
                aria-hidden="true"
                className={`relative flex h-9 w-11 items-center justify-center border-2 border-teal font-serif text-[16px] font-semibold sm:h-10 sm:w-[50px] sm:text-[18px] ${i % 2 ? PEBBLE_ALT : "pebble"} ${last ? "bg-teal text-white" : "bg-chalk text-teal"}`}
              >
                {i + 1}
              </span>
              <span
                className={`font-serif text-[18px] leading-[1.45] sm:text-[20px] ${last ? "font-semibold" : ""}`}
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
