import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
import { TransferInstructions } from "@/components/TransferInstructions";
import { formatAmountGel, formatDateKa, paymentMethodLabel } from "@/lib/cabinet";
import { createServerSupabase, getFunnelState } from "@/lib/supabase/server";
import { TierChange } from "./TierChange";

export const metadata: Metadata = { title: "გადახდები — ქართული რესპუბლიკა" };

export default async function BillingPage() {
  const supabase = await createServerSupabase();
  const state = await getFunnelState(); // layout guarantees exists+completed
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("id, amount_gel, paid_at, source")
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
              {rows.map((p) => (
                <tr key={p.id} className={tableRowClass}>
                  <td className={tableCellClass}>{formatDateKa(p.paid_at)}</td>
                  <td className={`${tableCellClass} font-semibold text-ink`}>
                    {formatAmountGel(p.amount_gel)} ₾
                  </td>
                  <td className={tableCellClass}>{paymentMethodLabel(p.source)}</td>
                  <td className={tableCellClass}>
                    <Pill status="active_member" label="დადასტურებული" />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      </div>
    </main>
  );
}
