import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  CabinetHead,
  CabinetPage,
  CabinetPanel,
  CabinetSectionLabel,
  cabinetCellClass,
  cabinetRowClass,
  cabinetThClass,
} from "@/components/CabinetPage";
import { Caps } from "@/components/Caps";
import { DataTable } from "@/components/DataTable";
import { Pill } from "@/components/Pill";
import { TransferInstructions } from "@/components/TransferInstructions";
import { formatAmountGel, formatDateKa, paymentMethodLabel, paymentStatusKa } from "@/lib/cabinet";
import { MEMBERSHIP_FEE_GEL } from "@/lib/funnel";
import { showMembershipDues } from "@/lib/membership-dues";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "გადახდები — ქართული რესპუბლიკა" };

export default async function BillingPage() {
  // Dues hidden (the default, ADR-037): the page does not exist, even by its address.
  if (!showMembershipDues()) notFound();
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
    <CabinetPage deco="knot">
      <CabinetHead title="გადახდები" lede="მართე შენი საწევრო და ნახე გადახდების ისტორია." />

      <div className="mt-8 grid items-start gap-6 md:mt-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-10">
        <div>
          <div className="border border-ink bg-chalk px-6 py-8 text-center md:py-10">
            <span className="inline-flex items-start font-serif font-bold text-ink">
              <span className="text-[96px] leading-[.9] md:text-[128px]">{MEMBERSHIP_FEE_GEL}</span>
              <span className="mt-1.5 text-[34px] leading-[1.1] md:text-[44px]">₾</span>
            </span>
            <span className="mt-3 block text-[16px] font-bold text-secondary">თვეში</span>
          </div>
          {state.status !== "active_member" ? (
            <p className="mt-4 mb-0 text-[14.5px] leading-[1.6] text-secondary">
              აქტიური წევრის სტატუსი გააქტიურდება პირველი შენატანის დადასტურების შემდეგ.
            </p>
          ) : null}
        </div>
        {/* legacy pre-Phase-2 accounts have no code (spec §3.8): no empty panel either */}
        {state.referenceCode ? (
          <CabinetPanel tone="ink" className="md:px-10">
            <TransferInstructions referenceCode={state.referenceCode} />
          </CabinetPanel>
        ) : null}
      </div>

      <CabinetPanel className="mt-8 md:mt-10 md:px-10">
        <CabinetSectionLabel
          aside={
            rows.length > 0 ? (
              <span className="text-[14px] text-secondary">ბოლო {rows.length} გადახდა</span>
            ) : undefined
          }
        >
          გადახდების ისტორია
        </CabinetSectionLabel>
        {rows.length === 0 ? (
          <div className="pt-6" data-testid="billing-empty">
            <p className="m-0 font-serif text-[18px] font-semibold text-ink">
              გადახდები ჯერ არ არის აღრიცხული
            </p>
            <p className="mt-1.5 mb-0 text-[15px] leading-[1.6] text-secondary">
              გადარიცხვებს ადასტურებს ფინანსური გუნდი — დადასტურებული გადახდები აქ გამოჩნდება.
            </p>
          </div>
        ) : (
          <div className="mt-2">
            <DataTable
              head={
                <>
                  {["თარიღი", "თანხა", "მეთოდი", "სტატუსი"].map((label) => (
                    <th key={label} scope="col" className={cabinetThClass}>
                      <Caps>{label}</Caps>
                    </th>
                  ))}
                </>
              }
            >
              {rows.map((p) => {
                const status = paymentStatusKa(p.voided_at);
                return (
                  <tr key={p.id} className={cabinetRowClass}>
                    <td className={`${cabinetCellClass} font-serif text-secondary`}>
                      {formatDateKa(p.paid_at)}
                    </td>
                    <td
                      className={`${cabinetCellClass} font-semibold ${
                        p.voided_at ? "line-through opacity-60" : ""
                      }`}
                    >
                      {formatAmountGel(p.amount_gel)} ₾
                    </td>
                    <td className={cabinetCellClass}>{paymentMethodLabel(p.source)}</td>
                    <td className={cabinetCellClass}>
                      <Pill status={status.pillStatus} label={status.label} />
                    </td>
                  </tr>
                );
              })}
            </DataTable>
            <div className="flex justify-between gap-4 border-t-2 border-ink px-4 pt-4 text-[16px] font-bold text-ink">
              <span>სულ {currentYear} წელს</span>
              <strong className="font-serif">{formatAmountGel(yearTotal)} ₾</strong>
            </div>
          </div>
        )}
      </CabinetPanel>
    </CabinetPage>
  );
}
