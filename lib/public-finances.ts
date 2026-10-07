/** Where the public finance (transparency) page lives. */
export const FINANCES_HREF = "/transparency";

/**
 * Whether public finances are visible: the /transparency page, every link to it, and the
 * homepage collected-dues figure. Hidden unless SHOW_PUBLIC_FINANCES is the word "true"
 * (owner decision 2026-10-07, ADR-034), so an unset or mistyped value can never expose them.
 * Whitespace around the word is ignored: a value piped in from a shell ends in a newline.
 *
 * Server-side only, and deliberately not a NEXT_PUBLIC_ variable: read it where the public
 * shell renders and pass the result down.
 */
export function showPublicFinances(): boolean {
  return process.env.SHOW_PUBLIC_FINANCES?.trim() === "true";
}

/** Drops the finance link from a nav or footer list unless finances are public. */
export function filterFinanceLinks<T extends { href: string }>(
  links: readonly T[],
  financesPublic: boolean,
): T[] {
  return financesPublic ? [...links] : links.filter((link) => link.href !== FINANCES_HREF);
}
