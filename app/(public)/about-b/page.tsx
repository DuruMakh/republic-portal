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

const COLUMN = "mx-auto max-w-[760px] px-5";
const BODY = "font-serif text-[clamp(1.02rem,1.5vw,1.15rem)] leading-[1.9] text-prose";

function Headpiece({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <Braid className="flex-1 text-brand" />
      <Rosette className="w-[clamp(64px,8vw,96px)] shrink-0 text-brand" />
      <Braid className="flex-1 text-brand" />
    </div>
  );
}

export default function AboutB() {
  return (
    <main className="py-[clamp(36px,5vw,64px)]">
      <div className="mx-auto max-w-[1000px] px-5">
        <Headpiece />
      </div>
      <header className={`${COLUMN} mt-10 text-center`}>
        <h1 className="font-serif text-[clamp(2.6rem,6vw,4.2rem)] leading-[1.1] font-bold text-ink">
          {ABOUT_TITLE}
        </h1>
        <p className="mx-auto mt-6 max-w-[24em] font-serif text-[clamp(1.2rem,2.2vw,1.55rem)] leading-normal text-brand">
          {ABOUT_INTRO}
        </p>
      </header>

      <ol className={`${COLUMN} mt-12 space-y-10`}>
        {ABOUT_BELIEFS.map((belief, i) => (
          <li key={belief} className="flex gap-5">
            <span
              aria-hidden="true"
              className="flex h-16 w-16 shrink-0 items-center justify-center border-2 border-brand font-serif text-[2.4rem] leading-none font-bold text-brand"
            >
              {BELIEF_LETTERS[i]}
            </span>
            <p className={BODY}>{belief}</p>
          </li>
        ))}
      </ol>

      <div className={`${COLUMN} my-14`}>
        <Braid className="text-teal" />
        <p className="py-10 text-center font-serif text-[clamp(1.25rem,2.4vw,1.7rem)] leading-[1.6] font-bold text-ink [text-wrap:balance]">
          {ABOUT_UNITY}
        </p>
        <Braid className="text-teal" />
      </div>

      <div className={`${COLUMN} space-y-6`}>
        <p className={BODY}>{ABOUT_GOAL}</p>
        <p className={BODY}>{ABOUT_PURPOSE}</p>
      </div>

      <div className="mx-auto mt-14 max-w-[1000px] px-5">
        <Headpiece />
      </div>
    </main>
  );
}
