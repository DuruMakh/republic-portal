import type { JsonLdObject } from "@/lib/structured-data";

/**
 * Structured data for search engines. Every "<" is written as <, so text inside the data
 * (a story title, say) can never close the script tag early.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
