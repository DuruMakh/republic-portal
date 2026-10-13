import type { Metadata } from "next";
import { OrnamentBand, Rosette } from "@/components/Ornament";
import {
  ABOUT_BELIEFS,
  ABOUT_GOAL,
  ABOUT_INTRO,
  ABOUT_PURPOSE,
  ABOUT_TITLE,
  ABOUT_UNITY,
  BELIEF_LETTERS,
} from "@/lib/about-copy";
import { SUPPORT_EYEBROW } from "@/lib/support-copy";

// app/layout.tsx sets a plain string title, so each public page carries the site-name suffix.
export const metadata: Metadata = { title: `${ABOUT_TITLE} — ${SUPPORT_EYEBROW}` };

const WRAP = "mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-10";
const SECTION = "py-[clamp(36px,5vw,64px)]";
const BODY = "font-serif text-[clamp(1rem,1.4vw,1.1rem)] leading-[1.8] text-prose";

export default function AboutPage() {
  const [firstWord, ...rest] = ABOUT_TITLE.split(" ");

  return (
    <main>
      <section
        className={`${WRAP} grid items-center gap-[clamp(20px,4vw,56px)] py-[clamp(28px,4vw,48px)] min-[900px]:grid-cols-[minmax(0,1fr)_auto]`}
      >
        <div>
          <h1 className="display-heading mb-5 text-[clamp(2.4rem,6vw,4.4rem)] leading-[1.05] text-ink">
            {firstWord} <span className="text-brand">{rest.join(" ")}</span>
          </h1>
          <p className="max-w-[24em] font-serif text-[clamp(1.2rem,2.2vw,1.6rem)] leading-normal text-ink">
            {ABOUT_INTRO}
          </p>
        </div>
        <Rosette className="hidden w-[clamp(150px,18vw,210px)] text-teal min-[900px]:block" />
      </section>

      <div className={WRAP}>
        <OrnamentBand className="text-teal" />
      </div>

      <section className={SECTION}>
        <ol className={`${WRAP} grid gap-y-10 min-[900px]:grid-cols-3 min-[900px]:gap-x-10`}>
          {ABOUT_BELIEFS.map((belief, i) => (
            <li key={belief} className="border-t-2 border-ink pt-5">
              <span
                aria-hidden="true"
                className="block font-serif text-[clamp(3.2rem,5vw,4.2rem)] leading-none font-extrabold text-transparent [-webkit-text-stroke:1.5px_var(--color-brand)]"
              >
                {BELIEF_LETTERS[i]}
              </span>
              <p className={`mt-4 ${BODY}`}>{belief}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${SECTION} border-y border-line bg-paper-bright`}>
        <div className={`${WRAP} flex flex-col items-center text-center`}>
          <Rosette className="w-14 text-teal" />
          <p className="mt-6 max-w-[34em] font-serif text-[clamp(1.2rem,2.3vw,1.6rem)] leading-[1.6] font-bold text-ink [text-wrap:balance]">
            {ABOUT_UNITY}
          </p>
        </div>
      </section>

      <section className={SECTION}>
        <div className={`${WRAP} grid gap-8 min-[900px]:grid-cols-2 min-[900px]:gap-14`}>
          <p className={`border-l-2 border-brand pl-5 ${BODY}`}>{ABOUT_GOAL}</p>
          <p className={BODY}>{ABOUT_PURPOSE}</p>
        </div>
        <div className={`${WRAP} mt-[clamp(36px,5vw,64px)]`}>
          <OrnamentBand className="text-teal" />
        </div>
      </section>
    </main>
  );
}
