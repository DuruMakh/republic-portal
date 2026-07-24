import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BallotBar } from "@/components/Ballot";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { SectionRule } from "@/components/SectionRule";
import { StatCard } from "@/components/StatCard";
import { barPct, conversionPct, hasAnyRole, isStaff } from "@/lib/admin";
import { formatAmountGel, formatDateKa } from "@/lib/cabinet";
import { formatCountKa } from "@/lib/format";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ადმინისტრირება — ქართული რესპუბლიკა" };

// Fresh, minimal remainder-row label (task-18-brief.md Step 2; ka-gated) — shown only
// when admin_region_stats returns more rows than the top-5 BallotBar rows above it.
const REMAINDER_LABEL = "დანარჩენი";

export default async function AdminOverviewPage() {
  const roles = await getAdminRoles();
  if (!isStaff(roles)) {
    // editor-only admins live in the content hub (spec §3.7)
    redirect("/admin/content");
  }
  const supabase = await createServerSupabase();
  const canSeePayments = hasAnyRole(roles, ["finance", "super_admin"]);

  const { data: overview, error: overviewError } = await supabase
    .from("admin_overview")
    .select("*")
    .single();
  if (overviewError) throw new Error(`admin_overview failed: ${overviewError.message}`);

  // No `.limit(5)` here (unlike the pre-Kronika query): the remainder row below needs
  // the FULL region result to know whether there's anything left over to summarize —
  // capping the fetch itself would make that remainder unreachable. Same table, same
  // columns, same order as before; only the row cap moved from the query to the render.
  const { data: regions, error: regionsError } = await supabase
    .from("admin_region_stats")
    .select("*")
    .order("member_count", { ascending: false });
  if (regionsError) throw new Error(`admin_region_stats failed: ${regionsError.message}`);
  const maxRegion = regions[0]?.member_count ?? 0;
  const shownRegions = regions.slice(0, 5);
  const restRegions = regions.slice(5);
  const remainderCount = restRegions.reduce((sum, r) => sum + r.member_count, 0);

  const recent = canSeePayments
    ? await supabase
        .from("admin_payments")
        .select("id, first_name, last_name, amount_gel, paid_at")
        .is("voided_at", null)
        .order("created_at", { ascending: false })
        .limit(6)
    : null;
  if (recent?.error) throw new Error(`admin_payments failed: ${recent.error.message}`);

  return (
    <main>
      <div className="mb-8 border-b-2 border-ink pb-4">
        <h1 className="font-serif text-[2rem] font-bold text-ink">მიმოხილვა</h1>
        <p className="mt-2 text-sm text-muted-fg">
          პლატფორმის ცოცხალი მაჩვენებლები — წევრები, დელეგატები, შემოსავალი და ვერიფიკაციის რიგი.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 border-t-2 border-ink">
        <StatCard
          value={formatCountKa(overview.registered_total)}
          label="რეგისტრირებული"
          sub="ჯამური რეესტრი — წევრებიც შედიან"
        />
        <StatCard
          value={formatCountKa(overview.total_completed)}
          label="წევრი"
          sub="დასრულებული წევრობა"
        />
        <StatCard
          value={conversionPct(overview.total_completed, overview.registered_total)}
          label="კონვერსია"
          sub="რეგისტრაციიდან წევრობამდე"
        />
        <StatCard
          value={formatCountKa(overview.active_members)}
          label="აქტიური წევრი"
          sub="↑ გადამხდელი მხარდამჭერები"
        />
        <StatCard
          value={formatCountKa(overview.approved_delegates)}
          label="დამტკიცებული დელეგატი"
          sub="↑ აქტიური რეგიონული ქსელი"
        />
        {/* Hand-composed to match StatCard's own markup byte-for-byte instead of a
            StatCard prop change: `accent` only supports "brand" and `sub` is a plain
            string with no className slot (StatCard.tsx is out of this task's scope),
            so the amber "needs attention" signal goes on a manually-styled sub line
            (task-18-brief.md Step 2). */}
        <div className="border-t-2 border-ink pt-3">
          <div className="font-serif text-[2.1rem] font-bold leading-tight text-brand">
            {formatCountKa(overview.pending_delegates)}
          </div>
          <div className="text-[0.74rem] text-muted-fg">ვერიფიკაციის მოლოდინში</div>
          <div className="text-[0.74rem] text-warn mt-0.5">საჭიროებს გადახედვას</div>
        </div>
        <StatCard
          value={`${formatCountKa(overview.mrr_gel)} ₾`}
          label="სავარაუდო MRR"
          sub="აქტიური წევრების საწევროების ჯამი"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {canSeePayments && recent ? (
          <Card>
            <SectionRule
              label="ბოლო ტრანზაქციები"
              action={
                <ButtonLink href="/admin/finances" variant="ghost" size="sm">
                  ყველა →
                </ButtonLink>
              }
            />
            {recent.data && recent.data.length > 0 ? (
              <DataTable
                head={
                  <>
                    <th className={tableThClass}>წევრი</th>
                    <th className={tableThClass}>თანხა ₾</th>
                    <th className={tableThClass}>თარიღი</th>
                  </>
                }
              >
                {recent.data.map((p) => (
                  <tr key={p.id} className={tableRowClass}>
                    <td className={`${tableCellClass} font-semibold`}>
                      {p.first_name} {p.last_name}
                    </td>
                    <td className={tableCellClass}>{formatAmountGel(p.amount_gel)}</td>
                    <td className={`${tableCellClass} text-muted-fg`}>{formatDateKa(p.paid_at)}</td>
                  </tr>
                ))}
              </DataTable>
            ) : (
              <p className="pt-6 text-sm text-muted-fg">გადახდები ჯერ არ არის აღრიცხული.</p>
            )}
          </Card>
        ) : null}

        <div className="flex flex-col gap-6">
          <Card variant="callout">
            <p className="text-xs font-bold uppercase tracking-wide text-brand">
              ვერიფიკაციის რიგი
            </p>
            <p className="mt-2 text-4xl font-extrabold text-brand">
              {formatCountKa(overview.pending_delegates)}
            </p>
            <p className="mt-1 text-sm font-semibold text-muted-fg">
              დელეგატი ელოდება დადასტურებას
            </p>
            {hasAnyRole(roles, ["verifier", "super_admin"]) ? (
              <div className="mt-4">
                <ButtonLink href="/admin/verify" variant="primary">
                  გადადი ვერიფიკაციაზე →
                </ButtonLink>
              </div>
            ) : null}
          </Card>

          <Card>
            <SectionRule label="წევრები მხარეების მიხედვით" />
            <div className="mt-4 flex flex-col gap-3">
              {shownRegions.map((r, i) => (
                <BallotBar
                  key={r.region_id}
                  label={r.name_ka}
                  pct={barPct(r.member_count, maxRegion)}
                  value={formatCountKa(r.member_count)}
                  tone={i === 0 ? "brand" : "ink"}
                />
              ))}
              {restRegions.length > 0 ? (
                <BallotBar
                  label={REMAINDER_LABEL}
                  // Same barPct(count, max) formula as the rows above, fed the summed
                  // remainder — clamped because several smaller regions combined can
                  // exceed the single largest region's count (unlike any individual
                  // row, which never can by construction).
                  pct={Math.min(100, barPct(remainderCount, maxRegion))}
                  value={formatCountKa(remainderCount)}
                  tone="muted"
                />
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
