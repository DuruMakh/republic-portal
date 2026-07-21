import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
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

  return (
    <main>
      <div className="mb-8">
        <Eyebrow>პირადი კაბინეტი</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-ink">გადახდები</h1>
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

        <Card
          header={
            <>
              <h3 className="text-base font-bold text-ink">გადახდების ისტორია</h3>
              {rows.length > 0 ? (
                <span className="text-xs text-muted-fg">ბოლო {rows.length} გადახდა</span>
              ) : null}
            </>
          }
          padded={false}
        >
          {rows.length === 0 ? (
            <div className="p-6 text-sm" data-testid="billing-empty">
              <p className="font-semibold text-ink">გადახდები ჯერ არ არის აღრიცხული</p>
              <p className="mt-1 text-muted-fg">
                გადარიცხვებს ადასტურებს ფინანსური გუნდი — დადასტურებული გადახდები აქ გამოჩნდება.
              </p>
            </div>
          ) : (
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
          )}
        </Card>
      </div>
    </main>
  );
}
