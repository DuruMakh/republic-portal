import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
import { TransferInstructions } from "@/components/TransferInstructions";
import { formatDateKa, paymentMethodLabel } from "@/lib/cabinet";
import type { FunnelState } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";
import { TierChange } from "./TierChange";

export const metadata: Metadata = { title: "გადახდები — ქართული რესპუბლიკა" };

export default async function BillingPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("funnel_state");
  const state = data as unknown as FunnelState; // layout guarantees exists+completed
  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount_gel, paid_at, source")
    .order("paid_at", { ascending: false }); // RLS scopes to own rows

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
          {state.tier !== null ? <TierChange currentTier={state.tier} /> : null}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted-fg">
                    <th className="px-6 py-3 font-semibold">თარიღი</th>
                    <th className="px-6 py-3 font-semibold">თანხა</th>
                    <th className="px-6 py-3 font-semibold">მეთოდი</th>
                    <th className="px-6 py-3 font-semibold">სტატუსი</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="px-6 py-3">{formatDateKa(p.paid_at)}</td>
                      <td className="px-6 py-3 font-semibold text-ink">{p.amount_gel} ₾</td>
                      <td className="px-6 py-3">{paymentMethodLabel(p.source)}</td>
                      <td className="px-6 py-3">
                        <Pill status="active_member" label="დადასტურებული" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
