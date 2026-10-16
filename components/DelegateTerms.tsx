import { Card } from "@/components/Card";
import { mtavruli } from "@/lib/mtavruli";

const TERMS = [
  "დელეგატი ადასტურებს, რომ რეგისტრაციისას მოწოდებული ყველა მონაცემი ნამდვილი და ზუსტია.",
  "დელეგატი მოქმედებს კანონმორჩილად და პლატფორმის ღირებულებების — გამჭვირვალობის, ანგარიშვალდებულებისა და პატივისცემის — შესაბამისად.",
  "დელეგატის საჯარო პროფილი და რეფერალური ბმული აქტიურდება მხოლოდ ადმინისტრაციული ვერიფიკაციის შემდეგ.",
  "წესების დარღვევის შემთხვევაში პლატფორმა იტოვებს უფლებას შეაჩეროს ან გააუქმოს დელეგატის სტატუსი.",
] as const;

const LETTERS = ["ა", "ბ", "გ", "დ"] as const;

/**
 * The four delegate terms (placeholder copy pending legal review) — ONE home,
 * rendered by the public /join/terms page and the /me/delegacy confirm flow, so
 * post-acceptance readers and pre-acceptance confirmers see the same text.
 * `lettered` is the cabinet's „ერთობა“ layout: old-Georgian letters as numerals.
 */
export function DelegateTerms({ layout = "card" }: { layout?: "card" | "lettered" }) {
  if (layout === "lettered") {
    return (
      <ol className="m-0 list-none border-t-2 border-ink p-0">
        {TERMS.map((term, i) => (
          <li
            key={term}
            className="grid grid-cols-[40px_minmax(0,1fr)] gap-4 border-b border-rule py-5 md:grid-cols-[64px_minmax(0,1fr)] md:gap-6 md:py-[26px]"
          >
            <span
              aria-hidden="true"
              className="font-aso text-[34px] font-light leading-none text-brand md:text-[44px]"
            >
              {mtavruli(LETTERS[i] ?? "")}
            </span>
            <span className="font-serif text-[17px] leading-[1.65] text-ink md:text-[20px]">
              {term}
            </span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <Card>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-ink">
        {TERMS.map((term) => (
          <li key={term}>{term}</li>
        ))}
      </ol>
    </Card>
  );
}
