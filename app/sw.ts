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

/**
 * Build revision, injected by scripts/build-sw.mjs via an esbuild `define`
 * (git short SHA, falling back to a timestamp when git is unavailable).
 * Precache entries MUST carry revision info: Serwist's PrecacheRoute is
 * consulted before `runtimeCaching` (first match wins) and serves precached
 * URLs cache-first, so un-revisioned entries would be frozen at install time
 * and never refresh across deploys. A new revision per deploy invalidates the
 * precache at SW install; skipWaiting/clientsClaim (below) then roll clients
 * forward promptly.
 */
declare const __SW_REVISION__: string;

const revision = __SW_REVISION__;

const serwist = new Serwist({
  precacheEntries: [
    { url: "/", revision },
    { url: "/offline", revision },
    { url: "/manifest.webmanifest", revision },
    { url: "/icons/icon-192.png", revision },
    { url: "/icons/icon-512.png", revision },
    { url: "/icons/icon-maskable-512.png", revision },
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
