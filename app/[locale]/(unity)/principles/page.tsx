import { languageAlternates } from "@/lib/i18n/metadata";
import { getCopy, getLocale } from "@/lib/i18n/server";
import { useCopy } from "@/lib/i18n/copy";
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
  PRINCIPLES_LEDE_CLOSE,
  PRINCIPLES_PAGE_TITLE,
} from "@/lib/principles-copy";

// app/layout.tsx sets a plain string title, so each public page carries the site-name suffix.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  return {
    title: t(PRINCIPLES_PAGE_TITLE) + " — " + t("ქართული რესპუბლიკა"),
    description: t(PRINCIPLES_LEDE),
    ...languageAlternates("/principles", await getLocale()),
  };
}

/**
 * /principles in the owner's „ერთობა“ design: the seal hero, the contents band, the twelve
 * principles (folded into rows on phones), and the closing.
 */
export default function PrinciplesPage() {
  const t = useCopy();
  return (
    <main>
      <section
        aria-labelledby="pr-title"
        className="pt-10 pb-11 sm:pt-[clamp(56px,7vw,104px)] sm:pb-[clamp(64px,7vw,104px)]"
      >
        <div className="unity-container flex flex-wrap items-center gap-8 sm:gap-[clamp(48px,6vw,96px)]">
          <div className="min-w-0 flex-[1.15_1_440px]">
            <UnityKicker>{t(PRINCIPLES_KICKER)}</UnityKicker>
            <h1
              id="pr-title"
              className="mt-5 font-display text-[56px] leading-[.92] font-bold tracking-[-.005em] sm:mt-[26px] sm:text-[clamp(56px,7.8vw,112px)] sm:leading-[.9]"
            >
              {t(PRINCIPLES_PAGE_TITLE)}
            </h1>
            <p className="mt-5 max-w-[32em] font-serif text-[17px] leading-[1.55] text-prose sm:mt-8 sm:text-[20px] sm:leading-[1.5]">
              {t(PRINCIPLES_LEDE)}
            </p>
            <p className="mt-4 max-w-[32em] font-serif text-[17px] leading-[1.55] font-semibold text-ink sm:mt-5 sm:text-[20px] sm:leading-[1.5]">
              {t(PRINCIPLES_LEDE_CLOSE)}
            </p>
            <p className="mt-9 text-[17px] max-sm:hidden">
              <UnityTextLink href={`#${PRINCIPLES_CONTENTS_ANCHOR}`}>
                <Caps>{t(PRINCIPLES_CONTENTS)}</Caps> <span aria-hidden="true">↓</span>
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
