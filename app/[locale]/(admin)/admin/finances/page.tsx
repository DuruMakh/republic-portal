import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import {
  AdminPageHeader,
  adminRowClass,
  AdminSectionTitle,
  AdminStat,
  adminTdClass,
  adminThClass,
} from "@/components/AdminUi";
import { Caps } from "@/components/Caps";
import { DataTable } from "@/components/DataTable";
import { Pill } from "@/components/Pill";
import { hasAnyRole } from "@/lib/admin";
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

  const txFrom = (txPage - 1) * TX_PAGE_SIZE;
  const {
    data: transactions,
    count: txCount,
    error: txError,
  } = await supabase
    .from("admin_payments")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(txFrom, txFrom + TX_PAGE_SIZE - 1);
  if (txError) throw new Error(`admin_payments failed: ${txError.message}`);

  return (
    <main>
      <AdminPageHeader
        title="ფინანსები"
        lede="გადახდების აღრიცხვა, ბალკ შესატყვისება და შემოსავლის სტატისტიკა."
      />

      <div className="flex flex-col gap-10">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Card>
            <AdminSectionTitle className="mb-5">ერთეული აღრიცხვა</AdminSectionTitle>
            <RecordPayment lookup={lookupMemberAction} record={recordPaymentAction} />
          </Card>

          <Card>
            <AdminSectionTitle className="mb-5">ბალკ შესატყვისება</AdminSectionTitle>
            <BulkMatch preview={previewBulkAction} confirm={confirmBulkAction} />
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-3">
          <AdminStat
            value={`${formatCountKa(stats.mrr_gel)} ₾`}
            label="თვიური შემოსავალი (MRR)"
            sub="აქტიური საწევროების ჯამი"
            accent
          />
          <AdminStat
            value={formatCountKa(stats.active_count)}
            label="აქტიური გამომწერი"
            sub="გადამხდელი წევრები"
          />
          <AdminStat
            value={`${avgGel.toFixed(2)} ₾`}
            label="საშ. შენატანი"
            sub="ერთ წევრზე თვეში"
          />
        </div>

        <Card>
          <AdminSectionTitle
            action={
              <span className="text-[0.72rem] text-muted-fg">
                ნაჩვენებია {transactions.length} / {formatCountKa(txCount ?? 0)}
              </span>
            }
          >
            ტრანზაქციები
          </AdminSectionTitle>
          {transactions.length === 0 ? (
            <p className="pt-6 text-sm text-muted-fg">გადახდები ჯერ არ არის აღრიცხული.</p>
          ) : (
            <DataTable
              bodyTestId="admin-tx-body"
              head={
                <>
                  <th className={adminThClass}>
                    <Caps>თარიღი</Caps>
                  </th>
                  <th className={adminThClass}>
                    <Caps>წევრი</Caps>
                  </th>
                  <th className={adminThClass}>
                    <Caps>თანხა ₾</Caps>
                  </th>
                  <th className={adminThClass}>
                    <Caps>თვეები</Caps>
                  </th>
                  <th className={adminThClass}>
                    <Caps>მეთოდი</Caps>
                  </th>
                  <th className={adminThClass}>
                    <Caps>ვინ აღრიცხა</Caps>
                  </th>
                  <th className={adminThClass}>
                    <Caps>სტატუსი</Caps>
                  </th>
                  <th className={adminThClass}></th>
                </>
              }
            >
              {transactions.map((t) => (
                <tr key={t.id} className={adminRowClass}>
                  <td className={`${adminTdClass} text-muted-fg`}>{formatDateKa(t.paid_at)}</td>
                  <td className={`${adminTdClass} font-semibold`}>
                    {t.first_name} {t.last_name}
                  </td>
                  <td className={`${adminTdClass} ${t.voided_at ? "line-through opacity-60" : ""}`}>
                    {formatAmountGel(t.amount_gel)}
                  </td>
                  <td className={adminTdClass}>{t.months_covered}</td>
                  <td className={`${adminTdClass} text-muted-fg`}>
                    {paymentMethodLabel(t.source)}
                  </td>
                  <td className={`${adminTdClass} text-muted-fg`}>
                    {t.recorded_by_first_name
                      ? `${t.recorded_by_first_name} ${t.recorded_by_last_name}`
                      : "სისტემა"}
                  </td>
                  <td className={adminTdClass} title={t.void_reason ?? undefined}>
                    {t.voided_at ? (
                      <Pill status="rejected" label="გაუქმებული" />
                    ) : (
                      <Pill status="active_member" label="აქტიური" />
                    )}
                  </td>
                  <td className={adminTdClass}>
                    {t.voided_at ? null : (
                      <VoidPaymentButton paymentId={t.id} voidPayment={voidPaymentAction} />
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>

        <div className="flex items-center justify-between border-t border-hairline pt-4">
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
