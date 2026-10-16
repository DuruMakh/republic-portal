import type { ReactNode } from "react";
import { Caps } from "@/components/Caps";
import { UnityKicker } from "@/components/UnityKicker";
import { UnityTextLink } from "@/components/UnityTextLink";

/**
 * The opening of a „ერთობა“ content page (news, events, finances, contact, rules, privacy): the
 * kicker, the big display heading and an optional serif intro. `children` sits underneath, for
 * pages that add a note or a link to the head.
 */
export function UnityPageHead({
  kicker,
  title,
  intro,
  children,
}: {
  kicker: string;
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="pb-7 pt-10 sm:pb-12 sm:pt-[clamp(56px,6vw,88px)]">
      <div className="unity-container">
        <UnityKicker>{kicker}</UnityKicker>
        <UnityDisplayTitle>{title}</UnityDisplayTitle>
        {intro ? (
          <p className="m-0 mt-4 max-w-[34em] font-serif text-[18px] leading-[1.6] text-prose sm:mt-[26px] sm:text-[clamp(19px,1.6vw,22px)]">
            {intro}
          </p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/**
 * The big display-font page heading under the kicker. `compact` is the smaller size for pages
 * that set the heading beside a form or ornament (contact, rules).
 */
export function UnityDisplayTitle({
  children,
  compact = false,
}: {
  children: string;
  compact?: boolean;
}) {
  return (
    <h1
      id="page-title"
      className={`m-0 mt-[18px] max-w-[16em] font-display text-[52px] font-bold leading-[.94] tracking-[-.005em] [text-wrap:balance] sm:mt-[26px] sm:leading-[.92] ${
        compact ? "sm:text-[clamp(56px,6vw,92px)]" : "sm:text-[clamp(64px,7.4vw,112px)]"
      }`}
    >
      {children}
    </h1>
  );
}

/** The head of a single article or event: the way back, the date kicker and the serif title. */
export function UnityArticleHead({
  backHref,
  backLabel,
  kicker,
  title,
}: {
  backHref: string;
  backLabel: string;
  kicker: string;
  title: string;
}) {
  return (
    <>
      <UnityTextLink href={backHref} className="mb-5 inline-block text-[15px] font-bold sm:mb-7">
        {backLabel}
      </UnityTextLink>
      <UnityKicker>{kicker}</UnityKicker>
      <h1
        id="page-title"
        className="m-0 mt-[18px] max-w-[16em] font-serif text-[32px] font-semibold leading-[1.16] tracking-[-.005em] [text-wrap:balance] sm:mt-[26px] sm:text-[clamp(40px,4vw,56px)] sm:leading-[1.12] sm:tracking-[-.01em]"
      >
        {title}
      </h1>
    </>
  );
}

/** The small spaced-capitals section heading over a 2px ink rule, with an optional action. */
export function UnitySectionLabel({
  children,
  action,
  id,
}: {
  children: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b-2 border-ink pb-3">
      <h2 id={id} className="m-0 text-[12px] font-bold tracking-[.14em] text-ink sm:text-[13px]">
        <Caps>{children}</Caps>
      </h2>
      {action}
    </div>
  );
}
