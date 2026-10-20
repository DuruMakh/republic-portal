/**
 * Whether the English version is shown: the /en pages (member and delegate accounts included),
 * the KA / EN language switch, and the English addresses in the sitemap and in each page's
 * language alternates. Hidden unless SHOW_ENGLISH is the word "true" (owner decision 2026-10-20),
 * so an unset or mistyped value keeps it hidden; while hidden, proxy.ts sends every /en address
 * to its Georgian page. Nothing is deleted: the English dictionaries and pages stay as they are
 * (ADR-054), and setting the switch brings every surface back unchanged. Whitespace around the
 * word is ignored, as for SHOW_PUBLIC_FINANCES.
 *
 * Server-side only, and deliberately not a NEXT_PUBLIC_ variable: read it where the page
 * renders and pass the result down (the root layout hands it to the language switch).
 */
export function showEnglish(): boolean {
  return process.env.SHOW_ENGLISH?.trim() === "true";
}
