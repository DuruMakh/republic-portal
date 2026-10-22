import { languageAlternates } from "@/lib/i18n/metadata";
import { getCopy, getLocale } from "@/lib/i18n/server";
import { useCopy } from "@/lib/i18n/copy";
import type { Metadata } from "next";
import { UnityKicker } from "@/components/UnityKicker";
import { UnityDisplayTitle } from "@/components/UnityPageHead";
import { SUPPORT_EYEBROW, SUPPORT_HEADING, SUPPORT_LEDE } from "@/lib/support-copy";
import { submitSupportMessageAction } from "./actions";
import { SupportForm } from "./SupportForm";

// app/layout.tsx sets a plain string title, not a template, so a child title
// REPLACES it outright. Every sibling public page therefore carries the suffix
// itself; without it the tab, bookmark and shared link for the page whose whole
// purpose is contacting this organisation would not name the organisation.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  return {
    title: t(SUPPORT_HEADING) + " — " + t("ქართული რესპუბლიკა"),
    description: t(SUPPORT_LEDE),
    ...languageAlternates("/support", await getLocale()),
  };
}

export default function SupportPage() {
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
          className="pointer-events-none absolute -right-[180px] -top-[120px] hidden w-[620px] max-w-none min-[900px]:block"
        />
        <div className="relative grid items-start gap-7 min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[900px]:gap-[clamp(40px,6vw,96px)]">
          <div>
            <UnityKicker>{t(SUPPORT_EYEBROW)}</UnityKicker>
            <UnityDisplayTitle compact>{t(SUPPORT_HEADING)}</UnityDisplayTitle>
            <p className="m-0 mt-4 max-w-[34em] font-serif text-[18px] leading-[1.6] text-prose sm:mt-[26px] sm:text-[clamp(19px,1.6vw,22px)]">
              {t(SUPPORT_LEDE)}
            </p>
          </div>
          <div className="border border-rule bg-chalk px-5 py-7 sm:p-12 min-[900px]:mt-2">
            <SupportForm submit={submitSupportMessageAction} />
          </div>
        </div>
      </div>
    </main>
  );
}
