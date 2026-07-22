import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
import { deriveDelegacyPhase } from "@/lib/cabinet";
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
      <div className="mb-8">
        <Eyebrow>პირადი კაბინეტი</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-ink">გახდი დელეგატი</h1>
        <p className="mt-2 text-sm text-muted-fg">
          დელეგატი მოძრაობის რეგიონული ხმაა — ვერიფიცირებული, საჯარო და ანგარიშვალდებული.
        </p>
      </div>
      {phase === "pending" ? (
        <Card>
          <div className="flex items-center gap-3">
            <Pill status="pending" label="განიხილება" />
            <h2 className="text-lg font-bold text-ink">მოთხოვნა გაგზავნილია</h2>
          </div>
          <p className="mt-2 text-sm text-muted-fg">
            შენი მოთხოვნა ადმინისტრაციასთანაა — შედეგს აქვე ნახავ. ამასობაში წევრობის ყველა
            შესაძლებლობა უცვლელად მუშაობს.
          </p>
        </Card>
      ) : phase === "rejected" ? (
        <Card>
          <div className="flex items-center gap-3">
            <Pill status="rejected" label="არ დამტკიცდა" />
            <h2 className="text-lg font-bold text-ink">მოთხოვნა არ დამტკიცდა</h2>
          </div>
          <p className="mt-2 text-sm text-muted-fg">
            ხელახლა წარდგენა ადმინისტრაციის გადაწყვეტილებით არის შესაძლებელი. შენი წევრობა უცვლელი
            რჩება.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <p className="rounded-lg bg-warn/10 p-3 text-sm font-semibold text-warn">
            სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას.
          </p>
          <Card>
            <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-ink">
              <li>
                დელეგატი ადასტურებს, რომ რეგისტრაციისას მოწოდებული ყველა მონაცემი ნამდვილი და
                ზუსტია.
              </li>
              <li>
                დელეგატი მოქმედებს კანონმორჩილად და პლატფორმის ღირებულებების — გამჭვირვალობის,
                ანგარიშვალდებულებისა და პატივისცემის — შესაბამისად.
              </li>
              <li>
                დელეგატის საჯარო პროფილი და რეფერალური ბმული აქტიურდება მხოლოდ ადმინისტრაციული
                ვერიფიკაციის შემდეგ.
              </li>
              <li>
                წესების დარღვევის შემთხვევაში პლატფორმა იტოვებს უფლებას შეაჩეროს ან გააუქმოს
                დელეგატის სტატუსი.
              </li>
            </ol>
          </Card>
          <Card>
            <h2 className="text-lg font-bold text-ink">დაადასტურე თანხმობა</h2>
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
