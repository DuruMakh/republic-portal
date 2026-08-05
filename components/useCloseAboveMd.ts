"use client";

import { useEffect } from "react";

// Tailwind v4's default `md` breakpoint. rem keeps this in lockstep when the
// browser's root font size changes; a pixel query would not be equivalent.
const DESKTOP_QUERY = "(min-width: 48rem)";

/** Closes a mobile-only overlay when its md:hidden wrapper becomes hidden. */
export function useCloseAboveMd(close: () => void) {
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    if (query.matches) close();

    function onChange(event: MediaQueryListEvent) {
      if (event.matches) close();
    }

    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [close]);
}
