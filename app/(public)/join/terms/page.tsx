import type { Metadata } from "next";
import { Card } from "@/components/Card";

export const metadata: Metadata = {
  title: "დელეგატის წესები და პირობები — ქართული რესპუბლიკა",
  description: "დელეგატად ყოფნის წესები და პირობები.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 pb-16 pt-10">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand">
        დელეგატის წესები და პირობები
      </p>
      <h1 className="mb-4 font-serif text-3xl font-bold text-ink">წესები და პირობები</h1>
      <p className="mb-6 rounded-lg bg-warn/10 p-3 text-sm font-semibold text-warn">
        სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას.
      </p>
      <Card>
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-ink">
          <li>
            დელეგატი ადასტურებს, რომ რეგისტრაციისას მოწოდებული ყველა მონაცემი ნამდვილი და ზუსტია.
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
    </main>
  );
}
