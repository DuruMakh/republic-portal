/** Which server-only switches are on for this request (see lib/public-finances, lib/events-switch). */
export interface PageSwitches {
  financesPublic: boolean;
  eventsShown: boolean;
}

/** The address roots each switch hides: the root itself and everything below it. */
const HIDDEN_ROOTS: readonly { root: string; shown: (switches: PageSwitches) => boolean }[] = [
  { root: "/transparency", shown: (s) => s.financesPublic },
  { root: "/events", shown: (s) => s.eventsShown },
];

/**
 * Whether an address belongs to a public page that a switch currently hides (ADR-034, ADR-042).
 * proxy.ts answers such an address with the site-wide not-found page before Next consults the
 * page's cache (ADR-040): Next regenerates a page-raised 404 without the page's own metadata, so
 * the hidden page alone could not keep the not-found tab title.
 *
 * Only the prerendered public pages are listed. The cabinet and admin events pages render on
 * every request, where the page's own not-found metadata holds, and keep their own chrome.
 */
export function hiddenBySwitch(pathname: string, switches: PageSwitches): boolean {
  return HIDDEN_ROOTS.some(
    ({ root, shown }) => !shown(switches) && (pathname === root || pathname.startsWith(`${root}/`)),
  );
}
