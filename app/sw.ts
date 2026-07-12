/**
 * Source for the PWA service worker.
 *
 * This file is bundled by `scripts/build-sw.mjs` (esbuild) into `public/sw.js` as a
 * "postbuild" step, run only after `next build`. It is NOT part of the Next.js
 * Turbopack build graph: `@serwist/next`'s Next.js integration is a webpack plugin
 * and does not support Turbopack builds yet (see DECISIONS.md ADR-008), so the
 * service worker is produced by a small standalone bundling step instead.
 *
 * `defaultCache` (from `@serwist/next/worker`) is framework-agnostic runtime-caching
 * config — it only matches on request URL/headers, so it works identically whether
 * the app was built with webpack or Turbopack. The precache list below is a small,
 * hand-picked set of stable (non-content-hashed) app-shell URLs; everything else
 * (hashed `/_next/static/*` chunks, images, fonts, API responses) is cached lazily
 * at runtime by `defaultCache`'s strategies.
 */
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

const serwist = new Serwist({
  precacheEntries: [
    "/",
    "/offline",
    "/manifest.webmanifest",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-maskable-512.png",
  ],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
