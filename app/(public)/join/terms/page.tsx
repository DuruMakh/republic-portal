import type { Metadata } from "next";
import { DelegateTerms } from "@/components/DelegateTerms";
import { Eyebrow } from "@/components/Eyebrow";

export const metadata: Metadata = {
  title: "დელეგატის წესები და პირობები — ქართული რესპუბლიკა",
  description: "დელეგატად ყოფნის წესები და პირობები.",
};

/**
 * Public again post-review: request_delegacy stamps tc_accepted_at against these
 * terms, so everyone who accepted them (pending/rejected/approved) — and anyone
 * logged out — must stay able to re-read them. The /me/delegacy confirm flow
 * renders the same <DelegateTerms /> inline.
 */
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 pb-16 pt-10">
      <div className="mb-2">
        <Eyebrow>დელეგატის წესები და პირობები</Eyebrow>
      </div>
      <h1 className="mb-4 font-serif text-3xl font-bold text-ink">წესები და პირობები</h1>
      <p className="mb-6 border border-warn-deep bg-warn/10 p-3 text-sm font-semibold text-warn-deep">
        სამუშაო ვერსია — ექვემდებარება იურიდიულ გადახედვას.
      </p>
      <div className="border-y-2 border-ink py-8">
        <DelegateTerms />
      </div>
    </main>
  );
}
