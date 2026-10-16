import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BallotBar } from "@/components/Ballot";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import {
  AdminPageHeader,
  AdminSectionTitle,
  AdminStat,
  adminRowClass,
  adminTdClass,
  adminThClass,
} from "@/components/AdminUi";
import { Caps } from "@/components/Caps";
import { barPct, conversionPct, hasAnyRole, isStaff } from "@/lib/admin";
import { formatAmountGel, formatDateKa } from "@/lib/cabinet";
import { formatCountKa } from "@/lib/format";
import { showMembershipDues } from "@/lib/membership-dues";
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
      <AdminPageHeader
        title="მიმოხილვა"
        lede="პლატფორმის ცოცხალი მაჩვენებლები — წევრები, დელეგატები, შემოსავალი და ვერიფიკაციის რიგი."
      />

      <div className="grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        <AdminStat
          value={formatCountKa(overview.registered_total)}
          label="მხარდამჭერი"
          sub="ჯამური რეესტრი — წევრებიც შედიან"
        />
        <AdminStat
          value={formatCountKa(overview.total_completed)}
          label="წევრი"
          sub="დასრულებული წევრობა"
        />
        <AdminStat
          value={conversionPct(overview.total_completed, overview.registered_total)}
          label="კონვერსია"
          sub="რეგისტრაციიდან წევრობამდე"
        />
        <AdminStat
          value={formatCountKa(overview.approved_delegates)}
          label="დამტკიცებული დელეგატი"
          sub="↑ აქტიური რეგიონული ქსელი"
        />
        <AdminStat
          value={formatCountKa(overview.pending_delegates)}
          label="ვერიფიკაციის მოლოდინში"
          sub="საჭიროებს გადახედვას"
          urgent
        />
        {/* No "active" tier while dues are dropped (ADR-037): the paying-member card is
            gone, and the dues total shows only with SHOW_MEMBERSHIP_DUES. */}
        {showMembershipDues() ? (
          <AdminStat
            value={`${formatCountKa(overview.mrr_gel)} ₾`}
            label="სავარაუდო MRR"
            sub="აქტიური წევრების საწევროების ჯამი"
          />
        ) : null}
      </div>

      <div className="mt-12 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {canSeePayments && recent ? (
          <Card>
            <AdminSectionTitle
              action={
                <ButtonLink href="/admin/finances" variant="ghost" size="md">
                  ყველა →
                </ButtonLink>
              }
            >
              ბოლო ტრანზაქციები
            </AdminSectionTitle>
            {recent.data && recent.data.length > 0 ? (
              <DataTable
                head={
                  <>
                    <th className={adminThClass}>
                      <Caps>წევრი</Caps>
                    </th>
                    <th className={`${adminThClass} text-right`}>
                      <Caps>თანხა ₾</Caps>
                    </th>
                    <th className={adminThClass}>
                      <Caps>თარიღი</Caps>
                    </th>
                  </>
                }
              >
                {recent.data.map((p) => (
                  <tr key={p.id} className={adminRowClass}>
                    <td className={`${adminTdClass} font-bold`}>
                      {p.first_name} {p.last_name}
                    </td>
                    <td className={`${adminTdClass} text-right`}>
                      {formatAmountGel(p.amount_gel)}
                    </td>
                    <td className={`${adminTdClass} text-secondary`}>{formatDateKa(p.paid_at)}</td>
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
            <p className="text-[12px] font-bold tracking-[.14em] text-brand">
              <Caps>ვერიფიკაციის რიგი</Caps>
            </p>
            <p className="mt-2.5 font-serif text-[64px] leading-none font-bold text-brand">
              {formatCountKa(overview.pending_delegates)}
            </p>
            <p className="mt-2.5 text-[15px] text-secondary">დელეგატი ელოდება დადასტურებას</p>
            {hasAnyRole(roles, ["verifier", "super_admin"]) ? (
              <ButtonLink
                href="/admin/verify"
                variant="primary"
                size="lg"
                className="mt-[22px] w-full"
              >
                გადადი ვერიფიკაციაზე →
              </ButtonLink>
            ) : null}
          </Card>

          <Card>
            <AdminSectionTitle>წევრები მხარეების მიხედვით</AdminSectionTitle>
            <div className="mt-4 flex flex-col gap-3">
              {shownRegions.map((r, i) => (
                <BallotBar
                  key={r.region_id}
                  label={r.name_ka}
                  pct={barPct(r.member_count, maxRegion)}
                  value={formatCountKa(r.member_count)}
                  tone={i === 0 ? "brand" : "teal"}
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
