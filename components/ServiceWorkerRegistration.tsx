"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (public/sw.js, built by scripts/build-sw.mjs).
 * Renders nothing. Intentionally inert outside production builds so the service
 * worker is never active in development, even if a stale public/sw.js happens to
 * exist on disk from a previous `npm run build`.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  return null;
}
