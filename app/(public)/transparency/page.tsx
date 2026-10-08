import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { Eyebrow } from "@/components/Eyebrow";
import { SectionRule } from "@/components/SectionRule";
import { NOT_FOUND_METADATA } from "@/components/NotFoundNotice";
import { StatCard } from "@/components/StatCard";
import { formatCountKa } from "@/lib/format";
import { showPublicFinances } from "@/lib/public-finances";
import {
  fetchPublicStats,
  fetchTransparencyRegions,
  fetchTransparencyStats,
} from "@/lib/supabase/public";

export const revalidate = 60;

const FINANCES_METADATA: Metadata = {
  title: "გამჭვირვალობა — ქართული რესპუბლიკა",
  description: "ღია მონაცემები მოძრაობის წევრობასა და შემოსავლებზე — პირდაპირ რეესტრიდან.",
  openGraph: { images: ["/og-default.png"] },
};

// While hidden the page presents the generic not-found title and never its own (ADR-034): a
// static export would still be streamed inside the not-found response and could show up as the
// browser tab title, and Next ignores the not-found file's own metadata for a page-raised 404.
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
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>ქართული რესპუბლიკა</Eyebrow>
      <h1 className="mt-1 font-serif text-4xl font-bold text-ink">გამჭვირვალობა</h1>
      <p className="mt-3 max-w-2xl text-muted-fg">
        ღია მონაცემები მოძრაობის წევრობასა და შემოსავლებზე — პირდაპირ რეესტრიდან.
      </p>

      <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          value={`${formatCountKa(Math.round(stats.total_gel))} ₾`}
          label="შეგროვებული საწევრო შენატანები"
          sub="სულ, დაარსებიდან"
        />
        <StatCard value={formatCountKa(publicStats.registered_total)} label="მხარდამჭერი" />
        <StatCard value={formatCountKa(stats.registered_members)} label="წევრი" />
        <StatCard value={formatCountKa(stats.approved_delegates)} label="დამტკიცებული დელეგატი" />
      </div>

      <div className="mt-10">
        <SectionRule label="წევრები რეგიონების მიხედვით" />
        <DataTable
          head={
            <>
              <th className={tableThClass}>რეგიონი</th>
              <th className={`${tableThClass} text-right`}>წევრი</th>
              <th className={`${tableThClass} text-right`}>შეგროვებული თანხა (₾)</th>
            </>
          }
        >
          {regions.map((r) => (
            <tr key={r.region_id} className={tableRowClass}>
              <td className={`${tableCellClass} font-semibold text-ink`}>{r.name_ka}</td>
              <td className={`${tableCellClass} text-right`}>{formatCountKa(r.members)}</td>
              <td className={`${tableCellClass} text-right`}>
                {formatCountKa(Math.round(r.collected_gel))}
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      <p className="mt-6 text-xs text-muted-fg">
        მონაცემები გამოითვლება ავტომატურად: შენატანები — აღრიცხული საბანკო გადარიცხვებიდან, წევრობა
        — რეგისტრაციის რეესტრიდან. გვერდი ახლდება უწყვეტად.
      </p>
    </main>
  );
}
