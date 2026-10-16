import type { Metadata } from "next";
import { AboutDocuments } from "@/components/AboutDocuments";
import { AboutGoalSteps } from "@/components/AboutGoalSteps";
import { AboutPortalCards } from "@/components/AboutPortalCards";
import { AboutTimeline } from "@/components/AboutTimeline";
import { UnityClosing } from "@/components/UnityClosing";
import { UnityKicker } from "@/components/UnityKicker";
import { UnityOrnament } from "@/components/UnityOrnament";
import {
  ABOUT_BELIEFS,
  ABOUT_CLOSING_LINK,
  ABOUT_GOAL_KICKER,
  ABOUT_GOAL_TITLE,
  ABOUT_INTRO_LEAD,
  ABOUT_INTRO_REST,
  ABOUT_PORTAL_KICKER,
  ABOUT_PORTAL_LEAD,
  ABOUT_PORTAL_SUB,
  ABOUT_ROOTS_INTRO,
  ABOUT_ROOTS_KICKER,
  ABOUT_ROOTS_TITLE,
  ABOUT_TITLE,
  ABOUT_UNITY_CLOSE,
  ABOUT_UNITY_LEAD,
} from "@/lib/about-copy";
import { showRatings } from "@/lib/ratings-switch";
import { SUPPORT_EYEBROW } from "@/lib/support-copy";

// app/layout.tsx sets a plain string title, so each public page carries the site-name suffix.
export const metadata: Metadata = { title: `${ABOUT_TITLE} — ${SUPPORT_EYEBROW}` };

const SECTION_TITLE =
  "m-0 mt-[18px] font-display text-[38px] font-bold leading-[.98] sm:mt-[22px] sm:text-[clamp(42px,5.3vw,76px)] sm:leading-[.96]";

/** /about in the owner's „ერთობა“ design: who we are, what we aim for, and where we come from. */
export default function AboutPage() {
  const ratingsShown = showRatings();

  return (
    <main>
      {/* Hero: who we are, and the three beliefs. */}
      <section
        aria-labelledby="about-title"
        className="relative overflow-hidden pb-[52px] pt-10 sm:pb-[clamp(80px,9vw,136px)] sm:pt-[clamp(64px,8vw,120px)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative watermark */}
        <img
          src="/unity/knot-cream.svg"
          alt=""
          width={280}
          height={277}
          className="pointer-events-none absolute -right-[120px] -top-[30px] h-auto w-[340px] max-w-none sm:-right-[170px] sm:-top-[60px] sm:w-[720px]"
        />
        <div className="unity-container relative">
          <UnityKicker>{ABOUT_TITLE}</UnityKicker>
          <h1
            id="about-title"
            className="m-0 mt-6 max-w-[15em] font-serif text-[34px] font-semibold leading-[1.14] tracking-[-.01em] sm:mt-8 sm:[text-wrap:balance] sm:text-[clamp(38px,5.2vw,76px)] sm:leading-[1.1]"
          >
            <span className="text-brand">{ABOUT_INTRO_LEAD}</span> {ABOUT_INTRO_REST}
          </h1>
          <ol
            aria-labelledby="about-title"
            className="m-0 mt-8 grid list-none gap-6 p-0 sm:mt-[clamp(48px,6vw,88px)] sm:grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] sm:gap-[clamp(32px,4vw,56px)]"
          >
            {ABOUT_BELIEFS.map((belief, i) => (
              <li key={belief} className="min-w-0 border-t-2 border-ink pt-4 sm:pt-6">
                <span
                  aria-hidden="true"
                  className="block text-[34px] font-black leading-none text-brand [font-stretch:62.5%] sm:text-[52px]"
                >
                  {`0${i + 1}`}
                </span>
                <p className="m-0 mt-3 font-serif text-[18px] leading-[1.6] text-prose sm:mt-5 sm:text-[clamp(19px,1.5vw,21px)] sm:leading-[1.62]">
                  {belief}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Wine band: together we can. */}
      <section className="relative overflow-hidden bg-wine text-sand">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative dotted map */}
        <img
          src="/unity/map-dots-dark.svg"
          alt=""
          width={1000}
          height={521}
          className="pointer-events-none absolute -bottom-10 -left-10 h-auto w-[520px] max-w-none sm:-bottom-[120px] sm:left-1/2 sm:w-[1300px] sm:-translate-x-1/2"
        />
        <div className="unity-container relative pb-16 pt-[60px] sm:py-[clamp(80px,10vw,152px)]">
          <p className="m-0 max-w-[23em] font-serif text-[26px] font-medium leading-[1.3] [text-wrap:pretty] sm:text-[clamp(28px,3.5vw,52px)] sm:leading-[1.24] sm:tracking-[-.005em]">
            {ABOUT_UNITY_LEAD} <span className="text-white">{ABOUT_UNITY_CLOSE}</span>
          </p>
        </div>
      </section>

      {/* Our goal: from unity to victory. */}
      <section aria-labelledby="goal-title" className="py-14 sm:py-[clamp(80px,9vw,136px)]">
        <div className="unity-container">
          <UnityKicker>{ABOUT_GOAL_KICKER}</UnityKicker>
          <h2 id="goal-title" className={SECTION_TITLE}>
            {ABOUT_GOAL_TITLE}
          </h2>
          <AboutGoalSteps />
        </div>
      </section>

      {/* The portal: what people can do here. */}
      <section
        aria-label={ABOUT_PORTAL_KICKER}
        className="border-y border-rule bg-chalk py-14 sm:py-[clamp(80px,9vw,136px)]"
      >
        <div className="unity-container">
          <div className="flex flex-wrap gap-5 sm:gap-[clamp(28px,4vw,64px)]">
            <div className="min-w-0 flex-[1_1_220px]">
              <UnityKicker>{ABOUT_PORTAL_KICKER}</UnityKicker>
            </div>
            <div className="min-w-0 flex-[3_1_560px]">
              <p className="m-0 font-serif text-[24px] font-medium leading-[1.32] text-ink sm:text-[clamp(26px,2.7vw,38px)] sm:leading-[1.3]">
                {ABOUT_PORTAL_LEAD}
              </p>
              <p className="m-0 mt-4 font-serif text-[18px] leading-[1.55] text-prose sm:mt-[22px] sm:text-[clamp(19px,1.6vw,22px)]">
                {ABOUT_PORTAL_SUB}
              </p>
            </div>
          </div>
          <AboutPortalCards ratingsShown={ratingsShown} />
        </div>
      </section>

      {/* Our roots: 1918 — 1991. */}
      <section id="roots" aria-labelledby="roots-title" className="relative bg-sandstone">
        <UnityOrnament className="sm:h-[22px] sm:bg-size-[auto_22px]" />
        <div className="unity-container grid items-start pb-[52px] pt-11 sm:gap-[clamp(40px,5vw,88px)] sm:pb-[clamp(72px,8vw,104px)] sm:pt-[clamp(64px,7vw,96px)] min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="min-w-0">
            <UnityKicker>{ABOUT_ROOTS_KICKER}</UnityKicker>
            <h2 id="roots-title" className={SECTION_TITLE}>
              {ABOUT_ROOTS_TITLE}
            </h2>
            <p className="m-0 mt-4 font-serif text-[17px] leading-[1.6] text-prose [text-wrap:pretty] sm:mt-6 sm:text-[clamp(17px,1.3vw,18.5px)] sm:leading-[1.62]">
              {ABOUT_ROOTS_INTRO}
            </p>
            <AboutDocuments />
          </div>
          <AboutTimeline />
        </div>
      </section>

      <UnityClosing link={ABOUT_CLOSING_LINK} />
    </main>
  );
}
