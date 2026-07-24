import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { DelegateTerms } from "@/components/DelegateTerms";
import { Pill } from "@/components/Pill";
import { DELEGACY_REJECTED_NOTE, DELEGACY_STATUS_LABELS, deriveDelegacyPhase } from "@/lib/cabinet";
import { getCabinetState } from "@/lib/supabase/server";
import { DelegacyConfirm } from "./DelegacyConfirm";

export const metadata: Metadata = { title: "გახდი დელეგატი — ქართული რესპუბლიკა" };

export default async function DelegacyPage() {
  const state = await getCabinetState();
  if (!state.exists) redirect("/join");
  const phase = deriveDelegacyPhase(state);
  if (phase === null) redirect("/me/membership"); // registered: membership comes first
  if (phase === "approved") redirect("/delegate");

  return (
    <main>
      <div className="mb-8 border-b-2 border-ink pb-4">
        <h1 className="font-serif text-[2rem] font-bold text-ink">გახდი დელეგატი</h1>
        <p className="mt-2 text-sm text-muted-fg">
          დელეგატი მოძრაობის რეგიონული ხმაა — ვერიფიცირებული, საჯარო და ანგარიშვალდებული.
        </p>
      </div>
      {phase === "pending" ? (
        <Card variant="callout">
          <div className="flex items-center gap-3">
            <Pill status="pending" label={DELEGACY_STATUS_LABELS.pending} />
            <h2 className="font-serif text-lg font-bold text-ink">მოთხოვნა გაგზავნილია</h2>
          </div>
          <p className="mt-2 text-sm text-muted-fg">
            შენი მოთხოვნა ადმინისტრაციასთანაა — შედეგს აქვე ნახავ. ამასობაში წევრობის ყველა
            შესაძლებლობა უცვლელად მუშაობს.
          </p>
          <Link
            href="/join/terms"
            className="mt-3 inline-block text-sm font-semibold text-brand hover:underline"
          >
            დელეგატის წესები და პირობები →
          </Link>
        </Card>
      ) : phase === "rejected" ? (
        <Card variant="callout">
          <div className="flex items-center gap-3">
            <Pill status="rejected" label={DELEGACY_STATUS_LABELS.rejected} />
            <h2 className="font-serif text-lg font-bold text-ink">მოთხოვნა არ დამტკიცდა</h2>
          </div>
          <p className="mt-2 text-sm text-muted-fg">
            {DELEGACY_REJECTED_NOTE} შენი წევრობა უცვლელი რჩება.
          </p>
          <Link
            href="/join/terms"
            className="mt-3 inline-block text-sm font-semibold text-brand hover:underline"
          >
            დელეგატის წესები და პირობები →
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <p className="border border-warn bg-warn/10 px-4 py-3 text-sm font-semibold text-warn-deep">
            სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას.
          </p>
          <DelegateTerms />
          <Card>
            <h2 className="font-serif text-lg font-bold text-ink">დაადასტურე თანხმობა</h2>
            <p className="mt-1 text-sm text-muted-fg">
              გაგზავნით ეთანხმები ზემოთ მოცემულ წესებს. ახალი მონაცემები არ გროვდება — ვერიფიკაციას
              შენი არსებული პროფილი გადის.
            </p>
            <div className="mt-4">
              <DelegacyConfirm />
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
