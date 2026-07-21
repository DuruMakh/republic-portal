import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { StatCard } from "@/components/StatCard";
import { formatCountKa } from "@/lib/format";
import { fetchTransparencyRegions, fetchTransparencyStats } from "@/lib/supabase/public";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "გამჭვირვალობა — ქართული რესპუბლიკა",
  description: "ღია მონაცემები მოძრაობის წევრობასა და შემოსავლებზე — პირდაპირ რეესტრიდან.",
  openGraph: { images: ["/og-default.png"] },
};

export default async function TransparencyPage() {
  const [stats, regionsRaw] = await Promise.all([
    fetchTransparencyStats(),
    fetchTransparencyRegions(),
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

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          value={`${formatCountKa(Math.round(stats.total_gel))} ₾`}
          label="შეგროვებული საწევრო შენატანები"
          sub="სულ, დაარსებიდან"
        />
        <StatCard value={formatCountKa(stats.registered_members)} label="წევრი" />
        <StatCard value={formatCountKa(stats.approved_delegates)} label="დამტკიცებული დელეგატი" />
      </div>

      <div className="mt-10">
        <Card title="წევრები რეგიონების მიხედვით" padded={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold text-muted-fg">
                <th className="px-5 py-3">რეგიონი</th>
                <th className="px-5 py-3 text-right">წევრი</th>
                <th className="px-5 py-3 text-right">აქტიური</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => (
                <tr key={r.region_id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-semibold text-ink">{r.name_ka}</td>
                  <td className="px-5 py-3 text-right">{formatCountKa(r.registered)}</td>
                  <td className="px-5 py-3 text-right">{formatCountKa(r.active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <p className="mt-6 text-xs text-muted-fg">
        მონაცემები გამოითვლება ავტომატურად: შენატანები — აღრიცხული საბანკო გადარიცხვებიდან, წევრობა
        — რეგისტრაციის რეესტრიდან. გვერდი ახლდება უწყვეტად.
      </p>
    </main>
  );
}
