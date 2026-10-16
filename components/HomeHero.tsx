import { Caps } from "@/components/Caps";
import { UnityButtonLink } from "@/components/UnityButtonLink";
import { UnityKicker } from "@/components/UnityKicker";
import { UnityTextLink } from "@/components/UnityTextLink";
import {
  HOME_HEADLINE,
  HOME_HERO_JOIN,
  HOME_HERO_KICKER,
  HOME_HERO_PRINCIPLES,
  HOME_LEDE,
  HOME_MAP_CAPTION,
} from "@/lib/home-copy";
import { PRINCIPLES_HREF } from "@/lib/principles-copy";

/**
 * The homepage hero on the wine band that starts in the header above it: the kicker, the
 * two-line headline, the lede with the two calls to act, and Georgia drawn in dots. On the phone
 * the map sits between the lede and a full-width button; from 1024px it stands to the right,
 * its foot level with the buttons.
 */
export function HomeHero() {
  return (
    <section className="relative overflow-hidden bg-wine text-limestone [&_:focus-visible]:outline-limestone">
      <div className="unity-container relative pb-9 pt-6 sm:pb-[clamp(32px,3vw,44px)] sm:pt-[clamp(20px,2vw,28px)]">
        <UnityKicker tone="light">{HOME_HERO_KICKER}</UnityKicker>
        <h1 className="m-0 mt-[22px] font-display text-[54px] font-bold leading-[.94] tracking-[-.004em] [text-wrap:balance] sm:mt-5 sm:text-[clamp(50px,8vw,116px)]">
          <span className="block">{HOME_HEADLINE[0]}</span>{" "}
          <span className="block text-sand">{HOME_HEADLINE[1]}</span>
        </h1>
        <div className="mt-[22px] flex flex-col sm:mt-[clamp(20px,2vw,28px)] lg:grid lg:grid-cols-[minmax(0,calc(340px_+_(100%_-_800px_-_clamp(36px,5vw,72px))_/_2.6))_minmax(0,1fr)] lg:grid-rows-[1fr_auto] lg:gap-x-[clamp(36px,5vw,72px)]">
          <p className="m-0 max-w-[24em] font-serif text-[19px] leading-[1.55] sm:text-[clamp(20px,1.8vw,25px)] lg:col-start-1 lg:row-start-1 lg:self-end">
            {HOME_LEDE}
          </p>
          <figure className="relative m-0 mt-7 motion-safe:transition-[opacity,translate] motion-safe:duration-[900ms] motion-safe:ease-[cubic-bezier(.2,.7,.2,1)] motion-safe:starting:translate-y-2.5 motion-safe:starting:opacity-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:self-end">
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative vector map */}
            <img
              src="/unity/map-dots.svg"
              alt=""
              width={1000}
              height={521}
              className="block h-auto w-full"
            />
            <figcaption className="mt-2.5 flex items-center justify-end gap-2 text-[11.5px] font-bold tracking-[.12em] text-sand sm:gap-2.5 sm:text-[12px] sm:tracking-[.14em] lg:absolute lg:bottom-[-4px] lg:right-0 lg:mt-0">
              <span aria-hidden="true" className="block h-px w-[18px] bg-sand sm:w-6" />
              <Caps>{HOME_MAP_CAPTION}</Caps>
            </figcaption>
          </figure>
          <div className="mt-7 flex flex-col gap-[18px] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-[30px] sm:gap-y-3.5 lg:col-start-1 lg:row-start-2 lg:mt-10 lg:pb-2">
            <UnityButtonLink
              href="/join"
              variant="cream"
              size="md"
              arrow
              className="w-full sm:w-auto"
            >
              {HOME_HERO_JOIN}
            </UnityButtonLink>
            <UnityTextLink
              href={PRINCIPLES_HREF}
              tone="light"
              className="self-center whitespace-nowrap text-[16px] sm:self-auto sm:text-[17px]"
            >
              {HOME_HERO_PRINCIPLES}
            </UnityTextLink>
          </div>
        </div>
      </div>
    </section>
  );
}
