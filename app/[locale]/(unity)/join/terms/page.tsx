import { languageAlternates } from "@/lib/i18n/metadata";
import { getCopy, getLocale } from "@/lib/i18n/server";
import { useCopy } from "@/lib/i18n/copy";
import type { Metadata } from "next";
import { DELEGATE_TERMS } from "@/components/DelegateTerms";
import { UnityKicker } from "@/components/UnityKicker";
import { UnityDisplayTitle } from "@/components/UnityPageHead";
import { GEORGIAN_NUMERALS } from "@/lib/principles-copy";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  return {
    title: t("დელეგატის წესები და პირობები") + " — " + t("ქართული რესპუბლიკა"),
    description: t("დელეგატად ყოფნის წესები და პირობები."),
    ...languageAlternates("/join/terms", await getLocale()),
  };
}

/**
 * Public again post-review: request_delegacy stamps tc_accepted_at against these
 * terms, so everyone who accepted them (pending/rejected/approved) — and anyone
 * logged out — must stay able to re-read them. The /me/delegacy confirm flow
 * renders the same DELEGATE_TERMS inline.
 */
export default function TermsPage() {
  const t = useCopy();
  return (
    <main
      aria-labelledby="page-title"
      className="relative overflow-hidden pb-16 pt-10 sm:pb-[clamp(88px,9vw,136px)] sm:pt-[clamp(56px,6vw,88px)]"
    >
      <div className="unity-container relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative ornament, fixed art */}
        <img
          src="/unity/knot-cream.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-[160px] top-10 hidden w-[600px] max-w-none min-[1100px]:block"
        />
        <div className="relative max-w-[860px]">
          <UnityKicker>{t("დელეგატის წესები და პირობები")}</UnityKicker>
          <UnityDisplayTitle compact>{t("წესები და პირობები")}</UnityDisplayTitle>
          <p
            role="note"
            className="m-0 mt-7 border-l-4 border-warn bg-warn/10 px-[18px] py-3.5 text-[15px] font-bold leading-[1.55] text-warn-deep sm:mt-9"
          >
            {t("სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას.")}
          </p>
          <ol className="m-0 mt-8 list-none border-t-2 border-ink p-0 sm:mt-10">
            {DELEGATE_TERMS.map((term, index) => (
              <li
                key={term}
                className="grid grid-cols-[40px_minmax(0,1fr)] gap-3.5 border-b border-rule py-[22px] sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-6 sm:py-[26px]"
              >
                <span
                  aria-hidden="true"
                  className="font-aso text-[32px] font-light leading-none text-brand sm:text-[44px]"
                >
                  {GEORGIAN_NUMERALS[index]}
                </span>
                <span className="font-serif text-[18px] leading-[1.65] text-ink sm:text-[20px]">
                  {t(term)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  );
}
