import Link from "next/link";
import { Caps } from "@/components/Caps";
import { UnityButtonLink } from "@/components/UnityButtonLink";
import { UnityKicker } from "@/components/UnityKicker";
import { UnityOrnament } from "@/components/UnityOrnament";
import { UnityTextLink } from "@/components/UnityTextLink";
import {
  HOME_MOTTO,
  HOME_MOTTO_SOURCE,
  HOME_PRINCIPLES_ALL,
  HOME_PRINCIPLES_KICKER,
  HOME_PRINCIPLES_TITLE,
} from "@/lib/home-copy";
import {
  GEORGIAN_NUMERALS,
  PRINCIPLES,
  PRINCIPLES_HOME_LINK,
  PRINCIPLES_HREF,
  principleAnchor,
} from "@/lib/principles-copy";

/** How many principles the phone lists before its „all twelve“ button. */
const PHONE_COUNT = 6;

/** The red braid either side of the motto, running out from it. */
const MOTTO_STRIP = "min-w-5 flex-1 sm:min-w-8 sm:h-[22px]! sm:bg-size-[auto_22px]!";

/**
 * „რა გვაერთიანებს“: the twelve principles as numbered tiles, each opening its place on
 * /principles (the phone lists the first six as rows, then a button to all twelve), and the
 * state motto between two braids over the faint coat of arms.
 */
export function HomePrinciples() {
  return (
    <section
      aria-labelledby="home-principles-title"
      className="pb-16 pt-10 sm:py-[clamp(48px,5vw,76px)]"
    >
      <div className="unity-container">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div>
            <UnityKicker>{HOME_PRINCIPLES_KICKER}</UnityKicker>
            <h2
              id="home-principles-title"
              className="m-0 mt-[18px] font-display text-[40px] font-bold leading-[.98] sm:mt-[22px] sm:text-[clamp(42px,5.3vw,76px)] sm:leading-[.96]"
            >
              {HOME_PRINCIPLES_TITLE}
            </h2>
          </div>
          <p className="m-0 mb-1.5 hidden sm:block">
            <UnityTextLink href={PRINCIPLES_HREF} className="text-[17px]">
              {PRINCIPLES_HOME_LINK}
            </UnityTextLink>
          </p>
        </div>

        <ol className="m-0 mt-[26px] list-none border-t-2 border-ink p-0 sm:mt-[clamp(40px,4.5vw,64px)] sm:grid sm:grid-cols-[repeat(auto-fill,minmax(min(270px,100%),1fr))] sm:border-l sm:border-t sm:border-rule">
          {PRINCIPLES.map(({ title }, i) => (
            <li key={title} className={i >= PHONE_COUNT ? "max-sm:hidden" : undefined}>
              <Link
                href={`${PRINCIPLES_HREF}#${principleAnchor(i + 1)}`}
                className="grid min-h-[77px] grid-cols-[38px_minmax(0,1fr)_16px] items-center gap-2.5 border-b border-rule py-2.5 text-ink no-underline transition-colors hover:text-ink sm:flex sm:h-full sm:min-h-[clamp(116px,13vw,172px)] sm:flex-col sm:items-stretch sm:gap-3.5 sm:border-r sm:px-[26px] sm:pb-7 sm:pt-[26px] sm:hover:bg-chalk"
              >
                <span
                  aria-hidden="true"
                  className="font-aso text-[22px] font-light leading-none text-brand sm:text-[42px]"
                >
                  {GEORGIAN_NUMERALS[i]}
                </span>
                <span className="text-[15.5px] font-semibold leading-[1.4] sm:text-[18px]">
                  {title}
                </span>
                <span aria-hidden="true" className="text-secondary sm:hidden">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <UnityButtonLink
          href={PRINCIPLES_HREF}
          variant="ghost"
          size="sm"
          className="mt-[22px] h-[52px]! w-full sm:hidden"
        >
          {HOME_PRINCIPLES_ALL}
        </UnityButtonLink>

        <div className="relative isolate mb-7 mt-[104px] flex items-center gap-3 sm:mb-0 sm:mt-[clamp(64px,8.4vw,120px)] sm:gap-[clamp(18px,2.2vw,32px)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative coat of arms */}
          <img
            src="/unity/arms-wine.svg"
            alt=""
            width={556}
            height={485}
            loading="lazy"
            className="pointer-events-none absolute left-1/2 top-[calc(50%+14px)] -z-10 h-[168px] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 opacity-20 sm:top-1/2 sm:h-[clamp(136px,14vw,200px)]"
          />
          <UnityOrnament className={`${MOTTO_STRIP} bg-right!`} />
          <figure className="relative m-0 flex-none text-center">
            <blockquote className="m-0">
              <p className="m-0 whitespace-nowrap font-serif text-[25px] font-medium leading-[1.1] text-brand sm:text-[clamp(28px,2.7vw,38px)]">
                {HOME_MOTTO}
              </p>
            </blockquote>
            <figcaption className="absolute left-1/2 top-full mt-2.5 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold tracking-[.1em] text-secondary sm:static sm:translate-x-0 sm:text-[12px] sm:tracking-[.14em]">
              <span className="inline-block bg-limestone px-1 py-px shadow-[0_0_10px_6px_var(--color-limestone)]">
                <Caps>{HOME_MOTTO_SOURCE}</Caps>
              </span>
            </figcaption>
          </figure>
          <UnityOrnament className={MOTTO_STRIP} />
        </div>
      </div>
    </section>
  );
}
