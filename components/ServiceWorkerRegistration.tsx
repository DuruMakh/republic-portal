"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (public/sw.js, built by scripts/build-sw.mjs).
 * Renders nothing. In non-production it not only skips registration but also
 * unregisters any service worker left behind by a previous local production run
 * (`npm run build && npm start`, then back to `npm run dev`) — otherwise dev
 * would be served through the stale production worker on this origin.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .catch((error: unknown) => {
          console.error("Stale service worker cleanup failed", error);
        });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  return null;
}
