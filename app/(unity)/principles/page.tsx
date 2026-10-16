import { Caps } from "@/components/Caps";
import type { Metadata } from "next";
import { PrinciplesContents } from "@/components/PrinciplesContents";
import { PrinciplesList } from "@/components/PrinciplesList";
import { PrinciplesSeal } from "@/components/PrinciplesSeal";
import { UnityClosing } from "@/components/UnityClosing";
import { UnityKicker } from "@/components/UnityKicker";
import { UnityTextLink } from "@/components/UnityTextLink";
import {
  PRINCIPLES_CLOSING_LINK,
  PRINCIPLES_CONTENTS,
  PRINCIPLES_CONTENTS_ANCHOR,
  PRINCIPLES_KICKER,
  PRINCIPLES_LEDE,
  PRINCIPLES_PAGE_TITLE,
} from "@/lib/principles-copy";
import { SUPPORT_EYEBROW } from "@/lib/support-copy";

// app/layout.tsx sets a plain string title, so each public page carries the site-name suffix.
export const metadata: Metadata = { title: `${PRINCIPLES_PAGE_TITLE} — ${SUPPORT_EYEBROW}` };

/**
 * /principles in the owner's „ერთობა“ design: the seal hero, the contents band, the twelve
 * principles (folded into rows on phones) with the principle 5 quote band, and the closing.
 */
export default function PrinciplesPage() {
  return (
    <main>
      <section
        aria-labelledby="pr-title"
        className="pt-10 pb-11 sm:pt-[clamp(56px,7vw,104px)] sm:pb-[clamp(64px,7vw,104px)]"
      >
        <div className="unity-container flex flex-wrap items-center gap-8 sm:gap-[clamp(48px,6vw,96px)]">
          <div className="min-w-0 flex-[1.15_1_440px]">
            <UnityKicker>{PRINCIPLES_KICKER}</UnityKicker>
            <h1
              id="pr-title"
              className="mt-5 font-display text-[56px] leading-[.92] font-bold tracking-[-.005em] sm:mt-[26px] sm:text-[clamp(56px,7.8vw,112px)] sm:leading-[.9]"
            >
              {PRINCIPLES_PAGE_TITLE}
            </h1>
            <p className="mt-5 max-w-[24em] font-serif text-[19px] leading-[1.55] text-prose sm:mt-8 sm:text-[clamp(21px,1.9vw,27px)] sm:leading-[1.5]">
              {PRINCIPLES_LEDE}
            </p>
            <p className="mt-9 text-[17px] max-sm:hidden">
              <UnityTextLink href={`#${PRINCIPLES_CONTENTS_ANCHOR}`}>
                <Caps>{PRINCIPLES_CONTENTS}</Caps> <span aria-hidden="true">↓</span>
              </UnityTextLink>
            </p>
          </div>
          <PrinciplesSeal />
        </div>
      </section>

      <PrinciplesContents />
      <PrinciplesList />
      <UnityClosing link={PRINCIPLES_CLOSING_LINK} />
    </main>
  );
}
