import type { Metadata } from "next";
import Image from "next/image";
import { ButtonLink } from "@/components/ButtonLink";
import { OrnamentRule } from "@/components/OrnamentRule";
import {
  ABOUT_BELIEF_MARKERS,
  ABOUT_BELIEFS,
  ABOUT_GOAL,
  ABOUT_INTRO,
  ABOUT_PORTAL,
  ABOUT_TITLE,
  ABOUT_UNITY,
} from "@/lib/about-copy";
import { CLOSING_CTA } from "@/lib/structure-copy";
import { SUPPORT_EYEBROW } from "@/lib/support-copy";

// app/layout.tsx sets a plain string title, so each public page carries the site-name suffix.
export const metadata: Metadata = { title: `${ABOUT_TITLE} — ${SUPPORT_EYEBROW}` };

const WRAP = "mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-10";
const SECTION = "py-[clamp(36px,5vw,64px)]";
const PROSE = "font-serif text-[clamp(1.02rem,1.4vw,1.12rem)] leading-[1.8]";

export default function AboutPage() {
  const [firstWord, ...rest] = ABOUT_TITLE.split(" ");

  return (
    <main>
      <section
        className={`${WRAP} grid items-center gap-[clamp(20px,4vw,56px)] py-[clamp(28px,4vw,48px)] min-[900px]:grid-cols-[minmax(0,1fr)_auto]`}
      >
        <div>
          <h1 className="display-heading mb-5 text-[clamp(2.4rem,5.6vw,4.4rem)] leading-[1.02] text-ink">
            {firstWord} <span className="text-brand">{rest.join(" ")}</span>
          </h1>
          <p className="max-w-[24em] font-serif text-[clamp(1.25rem,2.4vw,1.75rem)] leading-[1.45] text-ink">
            {ABOUT_INTRO}
          </p>
        </div>
        <Image
          src="/brand/emblem-roundel-red-notext.png"
          alt=""
          width={360}
          height={360}
          className="hidden w-[clamp(150px,18vw,210px)] min-[900px]:block"
        />
      </section>

      <div className={WRAP}>
        <OrnamentRule />
      </div>

      <section className={SECTION}>
        <ol className={`${WRAP} grid gap-[clamp(24px,3vw,44px)] min-[900px]:grid-cols-3`}>
          {ABOUT_BELIEFS.map((belief, i) => (
            <li
              key={belief}
              className="grid content-start grid-cols-[auto_minmax(0,1fr)] gap-4 border-t-2 border-ink pt-5 min-[900px]:grid-cols-1 min-[900px]:gap-3"
            >
              <span
                aria-hidden="true"
                className="font-serif text-[clamp(3rem,5vw,4.2rem)] leading-none font-extrabold text-transparent [-webkit-text-stroke:1.5px_var(--color-brand)]"
              >
                {ABOUT_BELIEF_MARKERS[i]}
              </span>
              <p className="font-serif text-[clamp(1.02rem,1.3vw,1.1rem)] leading-[1.75] text-ink">
                {belief}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-paper-bright">
        <div className={`${WRAP} py-[clamp(36px,5vw,64px)]`}>
          <OrnamentRule className="mx-auto max-w-[160px]" />
          <p className="mx-auto my-[clamp(20px,3vw,32px)] max-w-[30em] text-center font-serif text-[clamp(1.25rem,2.3vw,1.7rem)] leading-[1.5] font-semibold text-ink [text-wrap:balance]">
            {ABOUT_UNITY}
          </p>
          <OrnamentRule className="mx-auto max-w-[160px]" />
        </div>
      </section>

      <section className={SECTION}>
        <div className={`${WRAP} grid gap-[clamp(24px,4vw,60px)] min-[900px]:grid-cols-2`}>
          <p className={`border-l-2 border-ink pl-5 text-ink ${PROSE}`}>{ABOUT_GOAL}</p>
          <p className={`text-prose ${PROSE}`}>{ABOUT_PORTAL}</p>
        </div>
      </section>

      <div className="flex justify-center border-t border-line py-[clamp(28px,4vw,44px)]">
        <ButtonLink href="/join" size="lg">
          {CLOSING_CTA}
        </ButtonLink>
      </div>
    </main>
  );
}
