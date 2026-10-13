import type { Metadata } from "next";
import Image from "next/image";
import { Braid } from "@/components/Ornament";
import {
  ABOUT_BELIEFS,
  ABOUT_GOAL,
  ABOUT_INTRO,
  ABOUT_PURPOSE,
  ABOUT_TITLE,
  ABOUT_UNITY,
} from "@/lib/about-copy";
import { SUPPORT_EYEBROW } from "@/lib/support-copy";

// app/layout.tsx sets a plain string title, so each public page carries the site-name suffix.
export const metadata: Metadata = { title: `${ABOUT_TITLE} — ${SUPPORT_EYEBROW}` };

const WRAP = "mx-auto max-w-[1180px] px-5 sm:px-6 lg:px-10";

export default function AboutPage() {
  return (
    <main>
      <section
        className={`${WRAP} grid items-center gap-10 py-[clamp(40px,6vw,88px)] min-[900px]:grid-cols-[minmax(0,1fr)_auto] min-[900px]:gap-16`}
      >
        <div>
          <div className="text-[0.74rem] font-bold uppercase tracking-[.2em] text-brand">
            {SUPPORT_EYEBROW}
          </div>
          <h1 className="mt-4 font-serif text-[clamp(2.6rem,6vw,4.6rem)] leading-[1.05] font-bold text-ink">
            {ABOUT_TITLE}
          </h1>
          <p className="mt-6 max-w-[20em] font-serif text-[clamp(1.35rem,2.8vw,2.1rem)] leading-[1.4] text-ink">
            {ABOUT_INTRO}
          </p>
        </div>
        <Image
          src="/brand/emblem-roundel-red-notext.png"
          alt=""
          width={360}
          height={360}
          priority
          className="mx-auto w-[150px] sm:w-[200px] min-[900px]:w-[260px]"
        />
      </section>

      <section className="pb-[clamp(40px,6vw,80px)]">
        <ul className={WRAP}>
          {ABOUT_BELIEFS.map((belief) => (
            <li
              key={belief}
              className="border-t border-line py-[clamp(24px,3vw,36px)] last:border-b"
            >
              <p className="max-w-[46em] border-l-4 border-brand pl-[clamp(16px,2.5vw,32px)] font-serif text-[clamp(1.15rem,2vw,1.5rem)] leading-[1.6] text-ink">
                {belief}
              </p>
            </li>
          ))}
        </ul>
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

      <section className={`${WRAP} py-[clamp(48px,7vw,96px)]`}>
        <p className="max-w-[34em] font-serif text-[clamp(1.25rem,2.4vw,1.8rem)] leading-[1.5] font-bold text-ink">
          {ABOUT_GOAL}
        </p>
        <p className="mt-8 max-w-[44em] font-serif text-[clamp(1.05rem,1.6vw,1.2rem)] leading-[1.8] text-prose">
          {ABOUT_PURPOSE}
        </p>
      </section>
    </main>
  );
}
