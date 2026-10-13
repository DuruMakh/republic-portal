import { Braid } from "@/components/Ornament";
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

export default function AboutC() {
  const [firstWord, ...rest] = ABOUT_TITLE.split(" ");
  return (
    <main>
      <section className={`${WRAP} pt-[clamp(32px,5vw,64px)]`}>
        <h1 className="display-heading text-[clamp(4rem,14vw,11rem)] leading-[1.02] text-ink">
          {firstWord}
          <br />
          <span className="text-brand">{rest.join(" ")}</span>
        </h1>
        <div className="mt-8 grid gap-6 border-t-2 border-ink pt-6 min-[900px]:grid-cols-[1fr_1.4fr]">
          <div aria-hidden="true" className="hidden min-[900px]:block" />
          <p className="font-serif text-[clamp(1.3rem,2.6vw,2rem)] leading-[1.4] text-ink">
            {ABOUT_INTRO}
          </p>
        </div>
      </section>

      <ol className={`${WRAP} mt-[clamp(32px,5vw,64px)]`}>
        {ABOUT_BELIEFS.map((belief, i) => (
          <li
            key={belief}
            className="grid gap-4 border-t-2 border-ink py-[clamp(24px,3.5vw,44px)] min-[900px]:grid-cols-[1fr_1.4fr] min-[900px]:gap-10"
          >
            <span
              aria-hidden="true"
              className="display-heading text-[clamp(4rem,10vw,8rem)] leading-[0.8] text-brand"
            >
              {BELIEF_LETTERS[i]}
            </span>
            <p className="font-serif text-[clamp(1.15rem,2vw,1.55rem)] leading-[1.55] text-ink">
              {belief}
            </p>
          </li>
        ))}
      </ol>

      <section className="mt-6 bg-ink text-paper">
        <div className={`${WRAP} py-[clamp(48px,7vw,96px)]`}>
          <p className="display-heading max-w-[18em] text-[clamp(2rem,4.6vw,3.6rem)] leading-[1.18] text-paper">
            {ABOUT_UNITY}
          </p>
        </div>
        <Braid className="text-brand" groove="ink" />
      </section>

      <section
        className={`${WRAP} grid gap-10 py-[clamp(40px,6vw,80px)] min-[900px]:grid-cols-2 min-[900px]:gap-16`}
      >
        <p className="font-serif text-[clamp(1.05rem,1.6vw,1.25rem)] leading-[1.75] text-prose">
          {ABOUT_GOAL}
        </p>
        <p className="font-serif text-[clamp(1.05rem,1.6vw,1.25rem)] leading-[1.75] text-prose">
          {ABOUT_PURPOSE}
        </p>
      </section>
    </main>
  );
}
