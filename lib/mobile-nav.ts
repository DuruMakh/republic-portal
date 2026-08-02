/**
 * Every route→chrome decision for the mobile layer (spec §4.3–§4.8), as pure
 * functions with no React or Next imports. Components read from here; nothing
 * here reads from a component.
 */

export type MobileChrome = "public" | "back" | "cabinet";

export interface BackTarget {
  href: string;
  label: string;
}

// Splice sources: NEWS_INDEX/EVENTS_INDEX ship in lib/cabinet.ts's nav items;
// BOARD_INDEX and TERMS_LABEL (FOOTER_TERMS_LABEL) ship in the
// app/(public)/layout.tsx nav array; JOIN_LABEL, LOGIN_LABEL and
// MEMBERSHIP_LABEL are spliced from their respective screens (see
// scratch/mobile-strings.txt for exact provenance of every value below).
const NEWS_INDEX = "სიახლეები";
const EVENTS_INDEX = "ღონისძიებები";
const BOARD_INDEX = "რეიტინგი";
const JOIN_LABEL = "რეგისტრაცია";
const TERMS_LABEL = "წესები";
const LOGIN_LABEL = "შესვლა";
const MEMBERSHIP_LABEL = "წევრობა";

/** Exact-match back targets. Order-independent — pathnames are unique keys. */
const STATIC_BACK: Record<string, BackTarget> = {
  "/join": { href: "/", label: JOIN_LABEL },
  "/join/terms": { href: "/join", label: TERMS_LABEL },
  "/login": { href: "/", label: LOGIN_LABEL },
  "/me/membership": { href: "/me/profile", label: MEMBERSHIP_LABEL },
  "/me/membership/done": { href: "/me/profile", label: MEMBERSHIP_LABEL },
};

/**
 * Dynamic detail routes. Matched by prefix because [slug] values are unbounded.
 * The trailing slash is load-bearing: it keeps "/news" (an index, no back
 * header) from matching, and keeps the public "/delegates/" profile prefix from
 * colliding with the "/delegate" cabinet root.
 */
const PREFIX_BACK: ReadonlyArray<{ prefix: string; target: BackTarget }> = [
  { prefix: "/news/", target: { href: "/news", label: NEWS_INDEX } },
  { prefix: "/events/", target: { href: "/events", label: EVENTS_INDEX } },
  { prefix: "/delegates/", target: { href: "/leaderboard", label: BOARD_INDEX } },
];

const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  "/",
  "/leaderboard",
  "/news",
  "/events",
  "/transparency",
  "/support",
]);

/** Routes that ARE the call to action, so a join bar under them is noise. */
const NO_CTA_ROUTES: ReadonlySet<string> = new Set(["/join", "/join/terms", "/login"]);

function inCabinet(pathname: string): boolean {
  return (
    pathname === "/me" ||
    pathname.startsWith("/me/") ||
    pathname === "/delegate" ||
    pathname.startsWith("/delegate/")
  );
}

/**
 * The parent a „← უკან“ header links to, or null when the route is not a detail
 * screen. Deliberately a fixed parent rather than router.back(): an article
 * opened from a shared link has no history behind it, and back() would leave
 * the site entirely (spec §4.8).
 */
export function mobileBackTarget(pathname: string): BackTarget | null {
  const exact = STATIC_BACK[pathname];
  if (exact) return exact;
  for (const { prefix, target } of PREFIX_BACK) {
    if (pathname.startsWith(prefix) && pathname.length > prefix.length) return target;
  }
  return null;
}

/**
 * Which of the three headers a route gets. The back header wins over the
 * cabinet header, which is what takes the tab bar off the membership wizard.
 * Never called for /admin — admin chrome is out of scope and unchanged.
 */
export function mobileChrome(pathname: string): MobileChrome {
  if (mobileBackTarget(pathname) !== null) return "back";
  if (inCabinet(pathname)) return "cabinet";
  if (PUBLIC_ROUTES.has(pathname)) return "public";
  return "public";
}

export function showsJoinCta(pathname: string): boolean {
  return !NO_CTA_ROUTES.has(pathname);
}

export function showsTabBar(pathname: string): boolean {
  return mobileBackTarget(pathname) === null;
}
