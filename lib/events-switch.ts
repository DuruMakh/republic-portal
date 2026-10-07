/** Every events destination: the public list, the member RSVP page and the admin editor. */
const EVENT_HREFS: ReadonlySet<string> = new Set([
  "/events",
  "/me/events",
  "/admin/content/events",
]);

/**
 * Whether events are shown: the public /events pages and their header link, the homepage events
 * section, the cabinet events tab, page and card, the delegate panel's team-RSVP card and the
 * admin events editor. Hidden unless SHOW_EVENTS is the word "true" (owner decision 2026-10-08,
 * ADR-038), so an unset or mistyped value keeps them hidden. Nothing is deleted: the events
 * tables stay as they are, and setting the switch brings every surface back unchanged.
 * Whitespace around the word is ignored, as for SHOW_PUBLIC_FINANCES.
 *
 * Server-side only, and deliberately not a NEXT_PUBLIC_ variable: read it where the page
 * renders and pass the result down.
 */
export function showEvents(): boolean {
  return process.env.SHOW_EVENTS?.trim() === "true";
}

/** Drops every events link from a nav list unless events are shown. */
export function filterEventLinks<T extends { href: string }>(
  links: readonly T[],
  eventsShown: boolean,
): T[] {
  return eventsShown ? [...links] : links.filter((link) => !EVENT_HREFS.has(link.href));
}
