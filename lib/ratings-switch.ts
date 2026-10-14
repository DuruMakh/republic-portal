/** Where the public ranking (the delegate leaderboard) lives. */
export const RATINGS_HREF = "/leaderboard";

/**
 * Whether ratings are shown: the /leaderboard page and its header link, the homepage top five,
 * the member count and rank on a delegate's profile, the delegate panel's place in the ranking,
 * and the chosen delegate's member count and rank in the member cabinet. Hidden unless
 * SHOW_RATINGS is the word "true" (owner decision 2026-10-13, ADR-052), so an unset or mistyped
 * value keeps them hidden. Nothing is deleted: choosing a delegate, team sizes and the ranking
 * math stay as they are, and setting the switch brings every surface back unchanged.
 * Whitespace around the word is ignored, as for SHOW_PUBLIC_FINANCES.
 *
 * Server-side only, and deliberately not a NEXT_PUBLIC_ variable: read it where the page
 * renders and pass the result down.
 */
export function showRatings(): boolean {
  return process.env.SHOW_RATINGS?.trim() === "true";
}

/** Drops the ranking link from a nav list unless ratings are shown. */
export function filterRatingLinks<T extends { href: string }>(
  links: readonly T[],
  ratingsShown: boolean,
): T[] {
  return ratingsShown ? [...links] : links.filter((link) => link.href !== RATINGS_HREF);
}
