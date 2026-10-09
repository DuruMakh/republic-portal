"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

const PinnedPathname = createContext<string | null>(null);

/**
 * Pins the path the site chrome (Masthead, MobileMenu, MobileJoinCta) reasons about. The static
 * not-found page is prerendered once, for /_not-found, but opened at whatever address was
 * mistyped: chrome that differs by address would exist only on the client and fail hydration.
 */
export function PinChromePathname({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  return <PinnedPathname.Provider value={pathname}>{children}</PinnedPathname.Provider>;
}

/**
 * Vercel keys the root page's ISR entry as /index (requesting /index serves the homepage, and the
 * regenerated payload's canonical URL is /index), so a background regeneration renders the homepage
 * with usePathname() === "/index". The chrome would then mark no nav link, and React keeps that
 * server HTML on hydration. The app has no /index route, so the alias always means the homepage.
 * Not reproducible with a local `next start`; verified on the live sites on Next 16.2.10 and 16.3.8.
 */
const ROOT_ALIAS = "/index";

/** The path the site chrome reasons about: the live one, unless a PinChromePathname pins it. */
export function useChromePathname(): string {
  const live = usePathname();
  const path = useContext(PinnedPathname) ?? live;
  return path === ROOT_ALIAS ? "/" : path;
}
