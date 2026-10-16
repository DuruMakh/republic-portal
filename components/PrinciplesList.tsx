"use client";

import { Caps } from "@/components/Caps";
import { Fragment, useEffect, useState, useSyncExternalStore } from "react";
import { PrinciplesQuote } from "@/components/PrinciplesQuote";
import { PrinciplesRoots } from "@/components/PrinciplesRoots";
import {
  GEORGIAN_NUMERALS,
  PRINCIPLES,
  PRINCIPLES_LIST_LABEL,
  PRINCIPLES_QUOTE,
  principleAnchor,
  principleFromHash,
  principleLabel,
} from "@/lib/principles-copy";

// Below Tailwind's `sm` the principles fold into rows (the phone design).
const PHONE_QUERY = "(max-width: 639.98px)";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * The twelve principles. From `sm` up each is an open section (numeral, label and historical
 * roots on the left, title, lead and text on the right), with the principle 5 quote band after
 * the fifth. On phones they fold into rows, one open at a time (the first to begin with), and a
 * link to #principle-N opens that row and scrolls to it.
 */
export function PrinciplesList() {
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => "",
  );
  const [state, setState] = useState({ open: 1, hash: "" });
  // A new hash (a seal numeral, an old /principles#… link) opens its principle.
  if (state.hash !== hash) {
    setState({ open: principleFromHash(hash) ?? state.open, hash });
  }

  useEffect(() => {
    const number = principleFromHash(hash);
    if (number === null || !window.matchMedia(PHONE_QUERY).matches) return;
    // The row above may just have folded: bring the opened one back to the top.
    document.getElementById(principleAnchor(number))?.scrollIntoView({ block: "start" });
  }, [hash]);

  function toggle(number: number) {
    setState((s) => ({ ...s, open: s.open === number ? 0 : number }));
  }

  return (
    <section
      aria-label={PRINCIPLES_LIST_LABEL}
      className="flex flex-col max-sm:border-t-2 max-sm:border-ink"
    >
      {PRINCIPLES.map((principle, i) => {
        const number = i + 1;
        return (
          <Fragment key={principle.title}>
            <PrincipleSection
              number={number}
              open={state.open === number}
              onToggle={() => toggle(number)}
              ruled={number !== 1 && number !== PRINCIPLES_QUOTE.principle + 1}
              last={number === PRINCIPLES.length}
            />
            {number === PRINCIPLES_QUOTE.principle ? (
              <PrinciplesQuote className="max-sm:order-last max-sm:mt-12 max-sm:border-b max-sm:border-limestone/14" />
            ) : null}
          </Fragment>
        );
      })}
    </section>
  );
}

function PrincipleSection({
  number,
  open,
  onToggle,
  ruled,
  last,
}: {
  number: number;
  open: boolean;
  onToggle: () => void;
  ruled: boolean;
  last: boolean;
}) {
  const principle = PRINCIPLES[number - 1];
  if (!principle) return null;
  const { title, lead, body, roots, rootsArt } = principle;
  const id = principleAnchor(number);
  const numeral = GEORGIAN_NUMERALS[number - 1];

  return (
    <article
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-16 border-rule max-sm:border-b sm:py-[clamp(64px,7vw,112px)] min-[900px]:scroll-mt-0 ${
        ruled ? "sm:border-t" : ""
      } ${last ? "sm:pb-[clamp(80px,9vw,136px)]" : ""}`}
    >
      <h2 className="sm:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={onToggle}
          className="grid min-h-16 w-full cursor-pointer grid-cols-[40px_minmax(0,1fr)_20px] items-center gap-2.5 px-5 py-3.5 text-left text-ink transition-colors hover:bg-chalk"
        >
          <span
            aria-hidden="true"
            className="font-aso text-[24px] leading-none font-light text-brand"
          >
            {numeral}
          </span>
          <span className="text-[21px] leading-[1.1] font-black [font-stretch:62.5%]">
            <Caps>{title}</Caps>
          </span>
          <svg
            aria-hidden="true"
            width="14"
            height="9"
            viewBox="0 0 14 9"
            className={`block transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M1 1 L7 7 L13 1" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      </h2>
      <div
        id={`${id}-panel`}
        className={`unity-container flex flex-wrap gap-[clamp(20px,4vw,72px)] max-sm:flex-col max-sm:gap-0 max-sm:pr-5 max-sm:pb-[26px] max-sm:pl-[70px] ${
          open ? "" : "max-sm:hidden"
        }`}
      >
        <div className="min-w-0 max-sm:contents sm:flex-[1_1_200px]">
          <div
            aria-hidden="true"
            className="pb-[.16em] font-aso text-[clamp(96px,11vw,168px)] leading-[1.05] font-light text-transparent [-webkit-text-stroke:1.5px_var(--color-brand)] max-sm:hidden"
          >
            {numeral}
          </div>
          <div className="mt-1.5 text-[13px] font-bold tracking-[.14em] text-brand max-sm:hidden">
            <Caps>{principleLabel(number)}</Caps>
          </div>
          <PrinciplesRoots
            roots={roots}
            art={rootsArt}
            className="mt-10 max-w-[340px] max-sm:order-last max-sm:mt-[22px] max-sm:max-w-none"
          />
        </div>
        <div className="min-w-0 max-w-[780px] sm:flex-[3_1_560px]">
          <h2
            id={`${id}-title`}
            className="m-0 font-display text-[clamp(34px,3.9vw,56px)] leading-none font-bold text-balance max-sm:hidden"
          >
            {title}
          </h2>
          <p className="font-serif text-[19px] leading-[1.5] font-medium text-ink sm:mt-[30px] sm:text-[clamp(22px,2vw,28px)] sm:leading-[1.45]">
            {lead}
          </p>
          {body.map((text, i) => (
            <p
              key={text}
              className={`font-serif text-[16.5px] leading-[1.75] text-prose sm:text-[19px] sm:leading-[1.78] ${
                i === 0 ? "mt-3 sm:mt-[22px]" : "mt-2.5 sm:mt-[18px]"
              }`}
            >
              {text}
            </p>
          ))}
        </div>
      </div>
    </article>
  );
}
