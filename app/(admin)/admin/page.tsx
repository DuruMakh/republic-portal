import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
import { barPct, hasAnyRole, isStaff } from "@/lib/admin";
import { formatAmountGel, formatDateKa } from "@/lib/cabinet";
import { formatCountKa } from "@/lib/format";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ადმინისტრირება — ქართული რესპუბლიკა" };

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

  const { data: regions, error: regionsError } = await supabase
    .from("admin_region_stats")
    .select("*")
    .order("member_count", { ascending: false })
    .limit(5);
  if (regionsError) throw new Error(`admin_region_stats failed: ${regionsError.message}`);
  const maxRegion = regions[0]?.member_count ?? 0;

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">მიმოხილვა</h1>
        <p className="mt-2 text-sm text-muted-fg">
          პლატფორმის ცოცხალი მაჩვენებლები — წევრები, დელეგატები, შემოსავალი და ვერიფიკაციის რიგი.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          value={formatCountKa(overview.approved_delegates)}
          label="დამტკიცებული დელეგატი"
          sub="↑ აქტიური რეგიონული ქსელი"
        />
        <StatCard
          value={formatCountKa(overview.active_members)}
          label="აქტიური წევრი"
          sub="↑ გადამხდელი მხარდამჭერები"
        />
        <StatCard
          value={formatCountKa(overview.pending_delegates)}
          label="ვერიფიკაციის მოლოდინში"
          sub="საჭიროებს გადახედვას"
          accent="brand"
        />
        <StatCard
          value={`${formatCountKa(overview.mrr_gel)} ₾`}
          label="სავარაუდო MRR"
          sub="აქტიური წევრების საწევროების ჯამი"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {canSeePayments && recent ? (
          <Card
            header={
              <>
                <h3 className="text-base font-bold text-ink">ბოლო ტრანზაქციები</h3>
                <ButtonLink href="/admin/finances" variant="ghost" size="sm">
                  ყველა →
                </ButtonLink>
              </>
            }
            padded={false}
          >
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
              <p className="p-6 text-sm text-muted-fg">გადახდები ჯერ არ არის აღრიცხული.</p>
            )}
          </Card>
        ) : null}

        <div className="flex flex-col gap-6">
          <Card>
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

          <Card
            header={<h3 className="text-base font-bold text-ink">წევრები მხარეების მიხედვით</h3>}
          >
            <div className="flex flex-col gap-3">
              {regions.map((r) => (
                <div key={r.region_id}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-ink">{r.name_ka}</span>
                    <span className="text-sm font-extrabold text-ink">
                      {formatCountKa(r.member_count)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-md bg-surface">
                    <div
                      className="h-full rounded-md bg-brand"
                      style={{ width: `${barPct(r.member_count, maxRegion)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
