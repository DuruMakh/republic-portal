import { Braid, Rosette } from "@/components/Ornament";
import {
  ABOUT_BELIEFS,
  ABOUT_GOAL,
  ABOUT_INTRO,
  ABOUT_PURPOSE,
  ABOUT_TITLE,
  ABOUT_UNITY,
  BELIEF_LETTERS,
} from "@/lib/about-copy";

const WRAP = "mx-auto max-w-[1180px] px-5 sm:px-6 lg:px-10";
const BODY = "font-serif text-[clamp(1rem,1.4vw,1.1rem)] leading-[1.8] text-prose";

export default function AboutA() {
  return (
    <main>
      <section className="bg-ink text-paper">
        <Braid className="text-paper" groove="ink" />
        <div
          className={`${WRAP} grid items-center gap-10 py-[clamp(48px,7vw,96px)] min-[900px]:grid-cols-[minmax(0,1fr)_auto]`}
        >
          <div>
            <h1 className="display-heading text-[clamp(3rem,8vw,6rem)] leading-[0.95] text-paper">
              {ABOUT_TITLE}
            </h1>
            <div className="mt-6 h-1 w-24 bg-brand" />
            <p className="mt-6 max-w-[22em] font-serif text-[clamp(1.25rem,2.4vw,1.75rem)] leading-normal text-paper">
              {ABOUT_INTRO}
            </p>
          </div>
          <Rosette groove="ink" className="mx-auto w-[clamp(150px,22vw,260px)] text-paper" />
        </div>
        <Braid className="text-paper" groove="ink" />
      </section>

      <section className="py-[clamp(40px,6vw,80px)]">
        <ol className={`${WRAP} grid gap-6 min-[900px]:grid-cols-3`}>
          {ABOUT_BELIEFS.map((belief, i) => (
            <li
              key={belief}
              className="border border-ink border-t-4 border-t-brand bg-paper-bright p-[clamp(20px,2.5vw,32px)]"
            >
              <span
                aria-hidden="true"
                className="block font-serif text-[4.5rem] leading-none font-extrabold text-brand"
              >
                {BELIEF_LETTERS[i]}
              </span>
              <p className={`mt-5 ${BODY}`}>{belief}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-brand text-paper">
        <Braid className="text-paper" groove="brand" />
        <div className={`${WRAP} py-[clamp(44px,6vw,80px)] text-center`}>
          <p className="mx-auto max-w-[30em] font-serif text-[clamp(1.3rem,2.6vw,1.9rem)] leading-[1.55] font-bold [text-wrap:balance]">
            {ABOUT_UNITY}
          </p>
        </div>
        <Braid className="text-paper" groove="brand" />
      </section>

      <section className="py-[clamp(40px,6vw,80px)]">
        <div className={`${WRAP} grid gap-10 min-[900px]:grid-cols-2 min-[900px]:gap-16`}>
          <p className={`border-l-4 border-brand pl-6 ${BODY}`}>{ABOUT_GOAL}</p>
          <p className={`border-l-4 border-teal pl-6 ${BODY}`}>{ABOUT_PURPOSE}</p>
        </div>
      </section>
    </main>
  );
}
