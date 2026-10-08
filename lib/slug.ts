/**
 * Georgian → Latin per the national romanization system with aspirate
 * apostrophes dropped (URL-safe): თ/ტ→t, ფ/პ→p, ქ/კ→k, წ/ც→ts, ჭ/ჩ→ch, ყ→q.
 */
const MAP: Readonly<Record<string, string>> = {
  ა: "a",
  ბ: "b",
  გ: "g",
  დ: "d",
  ე: "e",
  ვ: "v",
  ზ: "z",
  თ: "t",
  ი: "i",
  კ: "k",
  ლ: "l",
  მ: "m",
  ნ: "n",
  ო: "o",
  პ: "p",
  ჟ: "zh",
  რ: "r",
  ს: "s",
  ტ: "t",
  უ: "u",
  ფ: "p",
  ქ: "k",
  ღ: "gh",
  ყ: "q",
  შ: "sh",
  ჩ: "ch",
  ც: "ts",
  ძ: "dz",
  წ: "ts",
  ჭ: "ch",
  ხ: "kh",
  ჯ: "j",
  ჰ: "h",
};

export function transliterateGeorgian(text: string): string {
  return [...text].map((ch) => MAP[ch] ?? ch).join("");
}

/** DB CHECKs cap slugs at 80 (news/events; delegate slugs share the habit). */
export const SLUG_MAX = 80;

/**
 * Generalized slug minting (Phase 5): news uses fallback "article", events
 * "event", delegates keep "delegati". Empty romanization (Cyrillic, emoji…)
 * falls back so every item stays publishable — the RPCs reject empty slugs.
 * The base is capped at SLUG_MAX (R2 §8.6) — the DB CHECK rejects longer.
 */
export function slugFrom(text: string, fallback: string): string {
  const base = transliterateGeorgian(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
  return base === "" ? fallback : base;
}

/** Every candidate stays ≤ SLUG_MAX, even suffixed ones (base shortens to fit "-${n}"). */
export function makeSlugFrom(text: string, fallback: string, taken: ReadonlySet<string>): string {
  const base = slugFrom(text, fallback);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
