import { Card } from "@/components/Card";

/**
 * The four delegate terms (placeholder copy pending legal review) — ONE home, read by the
 * public /join/terms page and the /me/delegacy confirm flow, so post-acceptance readers and
 * pre-acceptance confirmers see the same text.
 */
export const DELEGATE_TERMS = [
  "დელეგატი ადასტურებს, რომ რეგისტრაციისას მოწოდებული ყველა მონაცემი ნამდვილი და ზუსტია.",
  "დელეგატი მოქმედებს კანონმორჩილად და პლატფორმის ღირებულებების — გამჭვირვალობის, ანგარიშვალდებულებისა და პატივისცემის — შესაბამისად.",
  "დელეგატის საჯარო პროფილი და რეფერალური ბმული აქტიურდება მხოლოდ ადმინისტრაციული ვერიფიკაციის შემდეგ.",
  "წესების დარღვევის შემთხვევაში პლატფორმა იტოვებს უფლებას შეაჩეროს ან გააუქმოს დელეგატის სტატუსი.",
] as const;

/** The terms as the /me/delegacy confirm flow shows them. */
export function DelegateTerms() {
  return (
    <Card>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-ink">
        {DELEGATE_TERMS.map((term) => (
          <li key={term}>{term}</li>
        ))}
      </ol>
    </Card>
  );
}
