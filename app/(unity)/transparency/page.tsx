import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Caps } from "@/components/Caps";
import { NOT_FOUND_METADATA } from "@/components/NotFoundNotice";
import { UnityClosing } from "@/components/UnityClosing";
import { UnityPageHead, UnitySectionLabel } from "@/components/UnityPageHead";
import { UnityStat } from "@/components/UnityStat";
import { formatCountKa } from "@/lib/format";
import { CONTACT_CLOSING_LINK } from "@/lib/public-pages-copy";
import { showPublicFinances } from "@/lib/public-finances";
import {
  fetchPublicStats,
  fetchTransparencyRegions,
  fetchTransparencyStats,
} from "@/lib/supabase/public";

export const revalidate = 60;

const TITLE = "გამჭვირვალობა";
const INTRO = "ღია მონაცემები მოძრაობის წევრობასა და შემოსავლებზე — პირდაპირ რეესტრიდან.";

const TH =
  "border-b-2 border-ink px-3 py-3 text-[12px] font-bold tracking-[.12em] text-ink sm:px-4";
const TD = "border-b border-rule px-3 py-3 sm:px-4 sm:py-3.5";

const FINANCES_METADATA: Metadata = {
  title: `${TITLE} — ქართული რესპუბლიკა`,
  description: INTRO,
  openGraph: { images: ["/og-default.png"] },
};

// While hidden the page presents the generic not-found title and never its own (ADR-034): a
// static export would still be streamed inside the not-found response and could show up as the
// browser tab title. The public group's not-found file carries the same title (ADR-044).
// While hidden, visitors normally never reach this branch: proxy.ts answers /transparency with
// the site-wide not-found page first (ADR-040). It stays for the build and as a second line.
export function generateMetadata(): Metadata {
  return showPublicFinances() ? FINANCES_METADATA : NOT_FOUND_METADATA;
}

export default async function TransparencyPage() {
  // Hidden by owner decision (ADR-034): not-found for everyone, before any data is fetched.
  // Set SHOW_PUBLIC_FINANCES=true and redeploy to bring the page back as it was.
  if (!showPublicFinances()) notFound();

  const [stats, regionsRaw, publicStats] = await Promise.all([
    fetchTransparencyStats(),
    fetchTransparencyRegions(),
    fetchPublicStats(),
  ]);
  // codepoint compare, not localeCompare: mkhedruli is codepoint-alphabetical and
  // Node/browser ICU disagreements have broken ka-GE rendering before (DECISIONS)
  const regions = [...regionsRaw].sort(
    (a, b) => b.collected_gel - a.collected_gel || (a.name_ka < b.name_ka ? -1 : 1),
  );

  return (
    <main aria-labelledby="page-title">
      <UnityPageHead kicker="ქართული რესპუბლიკა" title={TITLE} intro={INTRO} />
      <section className="pb-12 pt-2 sm:pb-[88px] sm:pt-0">
        <dl className="unity-container m-0 grid grid-cols-2 gap-x-5 gap-y-7 lg:grid-cols-4 lg:gap-10">
          <UnityStat
            value={`${formatCountKa(Math.round(stats.total_gel))} ₾`}
            label="შეგროვებული საწევრო შენატანები"
            sub="სულ, დაარსებიდან"
          />
          <UnityStat value={formatCountKa(publicStats.registered_total)} label="მხარდამჭერი" />
          <UnityStat value={formatCountKa(stats.registered_members)} label="წევრი" />
          <UnityStat
            value={formatCountKa(stats.approved_delegates)}
            label="დამტკიცებული დელეგატი"
          />
        </dl>
      </section>
      <section aria-labelledby="regions-title" className="pb-16 sm:pb-[clamp(88px,9vw,136px)]">
        <div className="unity-container grid items-start gap-[clamp(40px,5vw,80px)] min-[900px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="min-w-0">
            <UnitySectionLabel id="regions-title">წევრები რეგიონების მიხედვით</UnitySectionLabel>
            <div className="relative mt-2 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-[15px] sm:min-w-0 sm:text-[16px]">
                <thead>
                  <tr>
                    <th scope="col" className={`${TH} text-left`}>
                      <Caps>რეგიონი</Caps>
                    </th>
                    <th scope="col" className={`${TH} text-right`}>
                      <Caps>წევრი</Caps>
                    </th>
                    <th scope="col" className={`${TH} text-right`}>
                      <Caps>შეგროვებული თანხა (₾)</Caps>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {regions.map((r) => (
                    <tr key={r.region_id}>
                      <td className={`${TD} font-semibold`}>{r.name_ka}</td>
                      <td className={`${TD} text-right font-serif text-secondary`}>
                        {formatCountKa(r.members)}
                      </td>
                      <td className={`${TD} text-right font-serif text-secondary`}>
                        {formatCountKa(Math.round(r.collected_gel))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="m-0 mt-6 max-w-[46em] text-[14px] leading-[1.6] text-secondary">
              მონაცემები გამოითვლება ავტომატურად: შენატანები — აღრიცხული საბანკო გადარიცხვებიდან,
              წევრობა — რეგისტრაციის რეესტრიდან. გვერდი ახლდება უწყვეტად.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative map, fixed art */}
          <img
            src="/public-pages/map-dots-grey.svg"
            alt=""
            aria-hidden="true"
            className="sticky top-6 hidden h-auto w-full min-[900px]:block"
          />
        </div>
      </section>
      <UnityClosing link={CONTACT_CLOSING_LINK} />
    </main>
  );
}
