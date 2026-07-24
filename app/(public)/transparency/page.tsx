import type { Metadata } from "next";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { Eyebrow } from "@/components/Eyebrow";
import { SectionRule } from "@/components/SectionRule";
import { StatCard } from "@/components/StatCard";
import { formatCountKa } from "@/lib/format";
import {
  fetchPublicStats,
  fetchTransparencyRegions,
  fetchTransparencyStats,
} from "@/lib/supabase/public";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "გამჭვირვალობა — ქართული რესპუბლიკა",
  description: "ღია მონაცემები მოძრაობის წევრობასა და შემოსავლებზე — პირდაპირ რეესტრიდან.",
  openGraph: { images: ["/og-default.png"] },
};

export default async function TransparencyPage() {
  const [stats, regionsRaw, publicStats] = await Promise.all([
    fetchTransparencyStats(),
    fetchTransparencyRegions(),
    fetchPublicStats(),
  ]);
  // codepoint compare, not localeCompare: mkhedruli is codepoint-alphabetical and
  // Node/browser ICU disagreements have broken ka-GE rendering before (DECISIONS)
  const regions = [...regionsRaw].sort(
    (a, b) => b.registered - a.registered || (a.name_ka < b.name_ka ? -1 : 1),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>ქართული რესპუბლიკა</Eyebrow>
      <h1 className="mt-1 font-serif text-4xl font-bold text-ink">გამჭვირვალობა</h1>
      <p className="mt-3 max-w-2xl text-muted-fg">
        ღია მონაცემები მოძრაობის წევრობასა და შემოსავლებზე — პირდაპირ რეესტრიდან.
      </p>

      <div className="mt-8 grid sm:grid-cols-3 gap-x-8">
        <StatCard
          value={`${formatCountKa(Math.round(stats.total_gel))} ₾`}
          label="შეგროვებული საწევრო შენატანები"
          sub="სულ, დაარსებიდან"
        />
        <StatCard value={formatCountKa(publicStats.registered_total)} label="რეგისტრირებული" />
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
              <th className={`${tableThClass} text-right`}>აქტიური</th>
            </>
          }
        >
          {regions.map((r) => (
            <tr key={r.region_id} className={tableRowClass}>
              <td className={`${tableCellClass} font-semibold text-ink`}>{r.name_ka}</td>
              <td className={`${tableCellClass} text-right`}>{formatCountKa(r.registered)}</td>
              <td className={`${tableCellClass} text-right`}>{formatCountKa(r.active)}</td>
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
