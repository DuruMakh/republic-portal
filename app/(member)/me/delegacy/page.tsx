import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CabinetHead,
  CabinetNote,
  CabinetPage,
  CabinetPanel,
  CabinetPanelTitle,
} from "@/components/CabinetPage";
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

  const termsLink = (
    <Link
      href="/join/terms"
      className="mt-5 inline-block text-[15px] font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
    >
      დელეგატის წესები და პირობები →
    </Link>
  );

  return (
    <CabinetPage deco="knot">
      <CabinetHead
        title="გახდი დელეგატი"
        lede="დელეგატი მოძრაობის რეგიონული ხმაა — ვერიფიცირებული, საჯარო და ანგარიშვალდებული."
      />
      <div className="mt-8 md:mt-12">
        {phase === "pending" ? (
          <CabinetPanel tone="ink" className="max-w-[760px]">
            <div className="flex flex-wrap items-center gap-3">
              <Pill status="pending" label={DELEGACY_STATUS_LABELS.pending} />
              <CabinetPanelTitle>მოთხოვნა გაგზავნილია</CabinetPanelTitle>
            </div>
            <p className="mt-3 mb-0 text-[16px] leading-[1.65] text-prose">
              შენი მოთხოვნა ადმინისტრაციასთანაა — შედეგს აქვე ნახავ. ამასობაში წევრობის ყველა
              შესაძლებლობა უცვლელად მუშაობს.
            </p>
            {termsLink}
          </CabinetPanel>
        ) : phase === "rejected" ? (
          <CabinetPanel tone="ink" className="max-w-[760px]">
            <div className="flex flex-wrap items-center gap-3">
              <Pill status="rejected" label={DELEGACY_STATUS_LABELS.rejected} />
              <CabinetPanelTitle>მოთხოვნა არ დამტკიცდა</CabinetPanelTitle>
            </div>
            <p className="mt-3 mb-0 text-[16px] leading-[1.65] text-prose">
              {DELEGACY_REJECTED_NOTE} შენი წევრობა უცვლელი რჩება.
            </p>
            {termsLink}
          </CabinetPanel>
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-[clamp(32px,4vw,64px)]">
            <div className="min-w-0">
              <CabinetNote>სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას.</CabinetNote>
              <div className="mt-8">
                <DelegateTerms layout="lettered" />
              </div>
            </div>
            <CabinetPanel tone="wine" as="aside" className="lg:sticky lg:top-6">
              <h2 className="m-0 font-serif text-[26px] font-semibold leading-[1.25] text-limestone md:text-[30px]">
                დაადასტურე თანხმობა
              </h2>
              <p className="mt-3.5 mb-0 text-[16.5px] leading-[1.65] text-sand">
                გაგზავნით ეთანხმები ზემოთ მოცემულ წესებს. ახალი მონაცემები არ გროვდება —
                ვერიფიკაციას შენი არსებული პროფილი გადის.
              </p>
              <div className="mt-[26px]">
                <DelegacyConfirm />
              </div>
            </CabinetPanel>
          </div>
        )}
      </div>
    </CabinetPage>
  );
}
