import { Card } from "@/components/Card";

/**
 * The four delegate terms (placeholder copy pending legal review) — ONE home,
 * rendered by the public /join/terms page and the /me/delegacy confirm flow, so
 * post-acceptance readers and pre-acceptance confirmers see the same text.
 */
export function DelegateTerms() {
  return (
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
          წესების დარღვევის შემთხვევაში პლატფორმა იტოვებს უფლებას შეაჩეროს ან გააუქმოს დელეგატის
          სტატუსი.
        </li>
      </ol>
    </Card>
  );
}
