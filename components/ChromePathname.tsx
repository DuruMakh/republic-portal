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

/** The path the site chrome reasons about: the live one, unless a PinChromePathname pins it. */
export function useChromePathname(): string {
  const live = usePathname();
  return useContext(PinnedPathname) ?? live;
}
