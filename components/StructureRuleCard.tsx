"use client";

import { useCopy } from "@/lib/i18n/copy";

import { useState } from "react";
import { useLocale } from "next-intl";
import { boardMemberLabel, votesLabel } from "@/lib/structure-copy";
import { Caps } from "@/components/Caps";

/**
 * A board decision rule as a small game: five pebbles, one per board member, with an ink line
 * after the votes the rule needs. It starts with exactly enough votes; pressing a pebble flips
 * that member's vote and the verdict under the row follows.
 */
export function StructureRuleCard({
  headline,
  body,
  needed,
  total,
  passes,
  fails,
}: {
  headline: string;
  body: string;
  needed: number;
  total: number;
  passes: string;
  fails: string;
}) {
  const t = useCopy();
  const english = useLocale() === "en";
  const countLabel = (count: number) =>
    english ? `${count} of ${total} votes` : votesLabel(count, total);
  const [votes, setVotes] = useState(() => Array.from({ length: total }, (_, i) => i < needed));
  const count = votes.filter(Boolean).length;
  const toggle = (seat: number) => setVotes((v) => v.map((on, i) => (i === seat ? !on : on)));

  return (
    <div className="border border-ink bg-chalk px-[18px] pt-5 pb-[18px] sm:px-[26px] sm:pt-6 sm:pb-[22px]">
      <div className="text-[26px] leading-none font-black text-brand [font-stretch:62.5%] sm:text-[30px]">
        <Caps>{t(headline)}</Caps>
      </div>
      <p className="mt-2 font-serif text-[16px] leading-normal sm:mt-2.5 sm:text-[18px]">
        {t(body)}
      </p>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2.5 sm:mt-[18px] sm:gap-y-3">
        <div
          role="group"
          aria-label={countLabel(needed)}
          className="relative flex gap-[var(--g)] [--g:4px] sm:[--g:6px]"
        >
          {votes.map((on, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              aria-label={english ? `${t("ბორდის წევრი")} ${i + 1}` : boardMemberLabel(i + 1)}
              onClick={() => toggle(i)}
              className="group flex h-[46px] w-12 cursor-pointer items-center justify-center border-0 bg-transparent p-0 sm:h-11"
            >
              <span
                className={`pebble block h-[26px] w-[34px] transition-[background-color,box-shadow,transform] duration-150 group-hover:scale-[1.12] motion-reduce:transition-none ${
                  on
                    ? "bg-teal shadow-[inset_0_0_0_1.5px_var(--color-teal)]"
                    : "bg-sandstone shadow-[inset_0_0_0_1.5px_#CFC4B3]"
                }`}
              />
            </button>
          ))}
          <span
            aria-hidden="true"
            className="absolute -top-1 -bottom-1 border-l-2 border-ink sm:-top-1.5 sm:-bottom-1.5"
            style={{ left: `calc(${needed} * 48px + ${needed - 0.5} * var(--g) - 1px)` }}
          />
        </div>
        <div
          aria-live="polite"
          className="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[14px] font-semibold sm:text-[15px]"
        >
          <span className="text-secondary">{countLabel(count)}</span>
          {count >= needed ? (
            <span className="inline-flex items-center gap-1.5 bg-teal px-2.5 py-1 text-white">
              <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true">
                <path d="M1 5 L4.5 8.5 L11 1.5" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
              {t(passes)}
            </span>
          ) : (
            <span className="inline-flex items-center border border-[#A39684] px-2.5 py-1 text-secondary">
              {t(fails)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
