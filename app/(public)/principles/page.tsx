import type { Metadata } from "next";
import Image from "next/image";
import { ButtonLink } from "@/components/ButtonLink";
import { PRINCIPLES, PRINCIPLES_TITLE, principleAnchor } from "@/lib/principles-copy";
import { CLOSING_CTA } from "@/lib/structure-copy";
import { SUPPORT_EYEBROW } from "@/lib/support-copy";

// app/layout.tsx sets a plain string title, so each public page carries the site-name suffix.
export const metadata: Metadata = { title: `${PRINCIPLES_TITLE} — ${SUPPORT_EYEBROW}` };

// The /structure page's grammar: same wrap, display headings and serif prose.
const WRAP = "mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-10";
// scroll-mt-24 clears the masthead, which is sticky below md (components/Masthead.tsx).
const SECTION = "scroll-mt-24 py-[clamp(32px,4.5vw,56px)] md:scroll-mt-6";
const NUMBER = "font-serif font-extrabold leading-[.8] text-brand";
// The site emblem, faint, beside each principle on desktop (owner choice, 2026-10-13).
const ORNAMENT = "hidden h-20 w-20 opacity-[.12] select-none lg:block";

export default function PrinciplesPage() {
  const [firstWord, ...rest] = PRINCIPLES_TITLE.split(" ");

  return (
    <main>
      <section className={`${WRAP} py-[clamp(28px,4vw,48px)]`}>
        <h1 className="display-heading text-[clamp(2rem,4.6vw,3.6rem)] leading-[1.05] text-ink">
          {firstWord} <span className="text-brand">{rest.join(" ")}</span>
        </h1>
      </section>

      <nav aria-label={PRINCIPLES_TITLE} className="border-t border-line">
        <ol className={`${WRAP} grid sm:grid-cols-2 lg:grid-cols-3`}>
          {PRINCIPLES.map(({ title }, i) => (
            <li key={title} className="border-b border-line sm:pr-5">
              <a
                href={`#${principleAnchor(i + 1)}`}
                className="group grid h-full grid-cols-[2.6rem_minmax(0,1fr)] items-baseline gap-2 py-3 text-ink no-underline"
              >
                <span
                  aria-hidden="true"
                  className="font-serif text-[1.6rem] leading-none font-extrabold text-transparent transition-colors [-webkit-text-stroke:1.2px_var(--color-brand)] group-hover:text-brand"
                >
                  {i + 1}
                </span>
                <span className="font-serif text-[0.98rem] leading-snug group-hover:text-brand">
                  {title}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {PRINCIPLES.map(({ title, paragraphs }, i) => {
        const id = principleAnchor(i + 1);
        return (
          <section
            key={title}
            id={id}
            aria-labelledby={`${id}-title`}
            className={i > 0 ? `${SECTION} border-t border-line` : SECTION}
          >
            <div
              className={`${WRAP} grid gap-x-[clamp(16px,3vw,40px)] gap-y-3 sm:grid-cols-[4.5rem_minmax(0,1fr)] lg:grid-cols-[6rem_minmax(0,1fr)_auto]`}
            >
              <div aria-hidden="true" className={`${NUMBER} text-[clamp(2.8rem,6vw,4.6rem)]`}>
                {i + 1}
              </div>
              <div className="max-w-[44em]">
                <h2
                  id={`${id}-title`}
                  className="display-heading text-[clamp(1.6rem,3vw,2.4rem)] text-ink"
                >
                  <span className="sr-only">{i + 1}. </span>
                  {title}
                </h2>
                <div className="mt-4 space-y-4 font-serif text-[clamp(1rem,1.3vw,1.08rem)] leading-[1.75] text-prose">
                  {paragraphs.map((text) => (
                    <p key={text}>{text}</p>
                  ))}
                </div>
              </div>
              <Image
                src="/brand/emblem-roundel-red-notext.png"
                alt=""
                aria-hidden="true"
                width={80}
                height={80}
                className={ORNAMENT}
              />
            </div>
          </section>
        );
      })}

      <div className="flex justify-center border-t border-line py-[clamp(28px,4vw,44px)]">
        <ButtonLink href="/join" size="lg">
          {CLOSING_CTA}
        </ButtonLink>
      </div>
    </main>
  );
}
