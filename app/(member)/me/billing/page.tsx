import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { Pill } from "@/components/Pill";
import { SectionRule } from "@/components/SectionRule";
import { TransferInstructions } from "@/components/TransferInstructions";
import { formatAmountGel, formatDateKa, paymentMethodLabel, paymentStatusKa } from "@/lib/cabinet";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";
import { TierChange } from "./TierChange";

export const metadata: Metadata = { title: "გადახდები — ქართული რესპუბლიკა" };

export default async function BillingPage() {
  const supabase = await createServerSupabase();
  const state = await getCabinetState(); // layout guarantees exists only
  if (!state.exists) redirect("/join"); // soft-nav defense: narrow before reading profile fields
  if (!state.completed) redirect("/me"); // members only (spec §4.2)
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("id, amount_gel, paid_at, source, voided_at")
    .order("paid_at", { ascending: false }); // RLS scopes to own rows
  if (paymentsError) {
    // a failed query must never masquerade as the honest "no payments yet" state
    throw new Error(`payments query failed: ${paymentsError.message}`);
  }

  const rows = payments ?? [];
  // Year-total row (spec §5.3): summed from the SAME rows this page already
  // renders — no separate query. Excludes voided rows (a cancelled transfer
  // never counted as a contribution); "current year" reuses formatDateKa's own
  // Tbilisi-shifted day/month/year so the bucket always agrees with what each
  // row's own date column displays.
  const currentYear = formatDateKa(new Date().toISOString()).slice(-4);
  const yearTotal = rows
    .filter((p) => p.voided_at === null && formatDateKa(p.paid_at).slice(-4) === currentYear)
    .reduce((sum, p) => sum + p.amount_gel, 0);

  return (
    <main>
      <div className="mb-8 border-b-2 border-ink pb-4">
        <h1 className="font-serif text-[2rem] font-bold text-ink">გადახდები</h1>
        <p className="mt-2 text-sm text-muted-fg">მართე შენი საწევრო და ნახე გადახდების ისტორია.</p>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          {/* null tier (legacy active_member) still gets a picker — the RPC accepts it */}
          <TierChange currentTier={state.tier} />
          <TransferInstructions tier={state.tier} referenceCode={state.referenceCode} />
          {state.status !== "active_member" ? (
            <p className="mt-4 text-sm text-muted-fg">
              აქტიური წევრის სტატუსი გააქტიურდება პირველი შენატანის დადასტურების შემდეგ.
            </p>
          ) : null}
        </Card>

        <Card>
          <SectionRule
            label="გადახდების ისტორია"
            action={
              rows.length > 0 ? (
                <span className="text-[0.72rem] text-muted-fg">ბოლო {rows.length} გადახდა</span>
              ) : undefined
            }
          />
          {rows.length === 0 ? (
            <div className="pt-6 text-sm" data-testid="billing-empty">
              <p className="font-semibold text-ink">გადახდები ჯერ არ არის აღრიცხული</p>
              <p className="mt-1 text-muted-fg">
                გადარიცხვებს ადასტურებს ფინანსური გუნდი — დადასტურებული გადახდები აქ გამოჩნდება.
              </p>
            </div>
          ) : (
            <>
              <DataTable
                head={
                  <>
                    <th className={tableThClass}>თარიღი</th>
                    <th className={tableThClass}>თანხა</th>
                    <th className={tableThClass}>მეთოდი</th>
                    <th className={tableThClass}>სტატუსი</th>
                  </>
                }
              >
                {rows.map((p) => {
                  const status = paymentStatusKa(p.voided_at);
                  return (
                    <tr key={p.id} className={tableRowClass}>
                      <td className={tableCellClass}>{formatDateKa(p.paid_at)}</td>
                      <td
                        className={`${tableCellClass} font-semibold text-ink ${
                          p.voided_at ? "line-through opacity-60" : ""
                        }`}
                      >
                        {formatAmountGel(p.amount_gel)} ₾
                      </td>
                      <td className={tableCellClass}>{paymentMethodLabel(p.source)}</td>
                      <td className={tableCellClass}>
                        <Pill status={status.pillStatus} label={status.label} />
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
              <div className="flex justify-between border-t-2 border-ink pt-2.5 text-[0.78rem] text-muted-fg">
                <span>სულ {currentYear} წელს</span>
                <strong className="font-serif text-ink">{formatAmountGel(yearTotal)} ₾</strong>
              </div>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
