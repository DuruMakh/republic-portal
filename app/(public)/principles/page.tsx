import type { Metadata } from "next";
import { ButtonLink } from "@/components/ButtonLink";
import { PRINCIPLES, PRINCIPLES_TITLE } from "@/lib/principles-copy";
import { CLOSING_CTA } from "@/lib/structure-copy";
import { SUPPORT_EYEBROW } from "@/lib/support-copy";

// app/layout.tsx sets a plain string title, so each public page carries the site-name suffix.
export const metadata: Metadata = { title: `${PRINCIPLES_TITLE} — ${SUPPORT_EYEBROW}` };

const WRAP = "mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-10";
const OUTLINED =
  "font-serif font-extrabold text-transparent [-webkit-text-stroke:1.5px_var(--color-brand)]";

export default function PrinciplesPage() {
  const [firstWord, ...rest] = PRINCIPLES_TITLE.split(" ");

  return (
    <main>
      <section
        className={`${WRAP} grid items-center gap-[clamp(20px,4vw,56px)] py-[clamp(28px,4vw,48px)] min-[900px]:grid-cols-[minmax(0,1fr)_auto]`}
      >
        <h1 className="display-heading text-[clamp(2.4rem,5.6vw,4.4rem)] leading-[1.02] text-ink">
          {firstWord} <span className="text-brand">{rest.join(" ")}</span>
        </h1>
        <div
          aria-hidden="true"
          className={`hidden text-[clamp(5rem,10vw,8rem)] leading-[.8] select-none min-[900px]:block ${OUTLINED}`}
        >
          {PRINCIPLES.length}
        </div>
      </section>

      <nav aria-label={PRINCIPLES_TITLE} className="border-y border-line">
        <ol
          className={`${WRAP} grid py-3 min-[700px]:grid-cols-2 min-[700px]:gap-x-8 lg:grid-cols-3`}
        >
          {PRINCIPLES.map(({ title }, i) => (
            <li key={title}>
              <a
                href={`#principle-${i + 1}`}
                className="flex items-baseline gap-3 border-b border-hairline py-2.5 text-ink no-underline hover:text-brand"
              >
                <span className="w-6 shrink-0 font-serif font-bold text-brand">{i + 1}</span>{" "}
                <span className="text-[0.88rem] font-semibold leading-snug">{title}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className={WRAP}>
        {PRINCIPLES.map(({ title, paragraphs }, i) => (
          <section
            key={title}
            id={`principle-${i + 1}`}
            aria-labelledby={`principle-${i + 1}-title`}
            // scroll-mt-24 clears the masthead, which is sticky below md (components/Masthead.tsx).
            className="grid scroll-mt-24 gap-x-[clamp(16px,3vw,40px)] gap-y-2 border-t border-line py-[clamp(28px,4vw,48px)] first:border-t-0 md:scroll-mt-6 min-[700px]:grid-cols-[5.5rem_minmax(0,1fr)]"
          >
            <span
              aria-hidden="true"
              className={`text-[clamp(3rem,5vw,4.4rem)] leading-none ${OUTLINED}`}
            >
              {i + 1}
            </span>
            <div>
              <h2
                id={`principle-${i + 1}-title`}
                className="display-heading text-[clamp(1.6rem,2.8vw,2.3rem)] text-ink"
              >
                {title}
              </h2>
              <div className="mt-4 max-w-[44em] space-y-4">
                {paragraphs.map((text) => (
                  <p
                    key={text}
                    className="font-serif text-[clamp(1.02rem,1.3vw,1.1rem)] leading-[1.8] text-prose"
                  >
                    {text}
                  </p>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="flex justify-center border-t border-line py-[clamp(28px,4vw,44px)]">
        <ButtonLink href="/join" size="lg">
          {CLOSING_CTA}
        </ButtonLink>
      </div>
    </main>
  );
}
