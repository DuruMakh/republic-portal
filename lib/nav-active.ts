/**
 * Longest matching href wins (owner fix #7). „მთავარი“ (/me) is a prefix of
 * every cabinet route, so bare prefix matching keeps it lit on every page.
 * Shared by CabinetNav (desktop) and MobileTabBar (mobile) so the rule cannot
 * drift between them — it was already fixed once and must not regress.
 */
export function activeNavHref(
  items: ReadonlyArray<{ href: string }>,
  pathname: string,
): string | null {
  let active: string | null = null;
  for (const item of items) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (active === null || item.href.length > active.length)) active = item.href;
  }
  return active;
}
