import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { Pill } from "@/components/Pill";
import { StatCard } from "@/components/StatCard";
import { barPct, hasAnyRole } from "@/lib/admin";
import { pageParamSchema } from "@/lib/admin-schemas";
import { formatAmountGel, formatDateKa, paymentMethodLabel } from "@/lib/cabinet";
import { formatCountKa } from "@/lib/format";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import {
  confirmBulkAction,
  lookupMemberAction,
  previewBulkAction,
  recordPaymentAction,
  voidPaymentAction,
} from "./actions";
import { BulkMatch } from "./BulkMatch";
import { RecordPayment } from "./RecordPayment";
import { VoidPaymentButton } from "./VoidPaymentButton";

export const metadata: Metadata = { title: "ფინანსები — ადმინისტრირება" };

export default async function AdminFinancesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["finance", "super_admin"])) redirect("/admin");

  const supabase = await createServerSupabase();
  const raw = await searchParams;
  const txPage = pageParamSchema.parse(raw.txPage);
  const TX_PAGE_SIZE = 20;

  const { data: stats, error: statsError } = await supabase
    .from("admin_finance_stats")
    .select("*")
    .single();
  if (statsError) throw new Error(`admin_finance_stats failed: ${statsError.message}`);
  const avgGel = stats.active_count > 0 ? stats.mrr_gel / stats.active_count : 0;
  const tierRows = [
    { tier: 5, count: stats.tier5_count },
    { tier: 10, count: stats.tier10_count },
    { tier: 20, count: stats.tier20_count },
  ];
  const maxTier = Math.max(1, ...tierRows.map((t) => t.count));

  const txFrom = (txPage - 1) * TX_PAGE_SIZE;
  const {
    data: transactions,
    count: txCount,
    error: txError,
  } = await supabase
    .from("admin_payments")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(txFrom, txFrom + TX_PAGE_SIZE - 1);
  if (txError) throw new Error(`admin_payments failed: ${txError.message}`);

  return (
    <main>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">ფინანსები</h1>
        <p className="mt-2 text-sm text-muted-fg">
          გადახდების აღრიცხვა, ბალკ შესატყვისება და შემოსავლის სტატისტიკა.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <Card header={<h3 className="text-base font-bold text-ink">ერთეული აღრიცხვა</h3>}>
          <RecordPayment lookup={lookupMemberAction} record={recordPaymentAction} />
        </Card>

        <Card header={<h3 className="text-base font-bold text-ink">ბალკ შესატყვისება</h3>}>
          <BulkMatch preview={previewBulkAction} confirm={confirmBulkAction} />
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            value={`${formatCountKa(stats.mrr_gel)} ₾`}
            label="თვიური შემოსავალი (MRR)"
            sub="აქტიური საწევროების ჯამი"
            accent="brand"
          />
          <StatCard
            value={formatCountKa(stats.active_count)}
            label="აქტიური გამომწერი"
            sub="გადამხდელი წევრები"
          />
          <StatCard value={`${avgGel.toFixed(2)} ₾`} label="საშ. შენატანი" sub="ერთ წევრზე თვეში" />
        </div>

        <Card
          header={
            <h3 className="text-base font-bold text-ink">
              განმეორებადი შენატანები დონეების მიხედვით
            </h3>
          }
        >
          <div className="flex flex-col gap-3">
            {tierRows.map((t) => (
              <div key={t.tier}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-ink">
                    {t.tier} ₾ <span className="font-semibold text-muted-fg">/ თვეში</span>
                  </span>
                  <span className="text-sm font-extrabold text-ink">
                    {formatCountKa(t.count)} გამომწერი
                  </span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-md bg-surface">
                  <div
                    className="h-full rounded-md bg-brand"
                    style={{ width: `${barPct(t.count, maxTier)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          header={
            <>
              <h3 className="text-base font-bold text-ink">ტრანზაქციები</h3>
              <span className="text-xs font-semibold text-muted-fg">
                ნაჩვენებია {transactions.length} / {formatCountKa(txCount ?? 0)}
              </span>
            </>
          }
          padded={false}
        >
          {transactions.length === 0 ? (
            <p className="p-6 text-sm text-muted-fg">გადახდები ჯერ არ არის აღრიცხული.</p>
          ) : (
            <DataTable
              bodyTestId="admin-tx-body"
              head={
                <>
                  <th className={tableThClass}>თარიღი</th>
                  <th className={tableThClass}>წევრი</th>
                  <th className={tableThClass}>თანხა ₾</th>
                  <th className={tableThClass}>თვეები</th>
                  <th className={tableThClass}>მეთოდი</th>
                  <th className={tableThClass}>ვინ აღრიცხა</th>
                  <th className={tableThClass}>სტატუსი</th>
                  <th className={tableThClass}></th>
                </>
              }
            >
              {transactions.map((t) => (
                <tr key={t.id} className={tableRowClass}>
                  <td className={`${tableCellClass} text-muted-fg`}>{formatDateKa(t.paid_at)}</td>
                  <td className={`${tableCellClass} font-semibold`}>
                    {t.first_name} {t.last_name}
                  </td>
                  <td
                    className={`${tableCellClass} ${t.voided_at ? "line-through opacity-60" : ""}`}
                  >
                    {formatAmountGel(t.amount_gel)}
                  </td>
                  <td className={tableCellClass}>{t.months_covered}</td>
                  <td className={`${tableCellClass} text-muted-fg`}>
                    {paymentMethodLabel(t.source)}
                  </td>
                  <td className={`${tableCellClass} text-muted-fg`}>
                    {t.recorded_by_first_name
                      ? `${t.recorded_by_first_name} ${t.recorded_by_last_name}`
                      : "სისტემა"}
                  </td>
                  <td className={tableCellClass} title={t.void_reason ?? undefined}>
                    {t.voided_at ? (
                      <Pill status="rejected" label="გაუქმებული" />
                    ) : (
                      <Pill status="active_member" label="აქტიური" />
                    )}
                  </td>
                  <td className={tableCellClass}>
                    {t.voided_at ? null : (
                      <VoidPaymentButton paymentId={t.id} voidPayment={voidPaymentAction} />
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <div className="flex items-center justify-between">
          {txPage > 1 ? (
            <ButtonLink href={`/admin/finances?txPage=${txPage - 1}`} variant="ghost" size="sm">
              ← წინა
            </ButtonLink>
          ) : (
            <span />
          )}
          {txFrom + TX_PAGE_SIZE < (txCount ?? 0) ? (
            <ButtonLink href={`/admin/finances?txPage=${txPage + 1}`} variant="ghost" size="sm">
              შემდეგი →
            </ButtonLink>
          ) : (
            <span />
          )}
        </div>
      </div>
    </main>
  );
}
