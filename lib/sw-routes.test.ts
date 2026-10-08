import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isNeverCached, runtimeCachesToClear } from "./sw-routes";

const at = (href: string) => new URL(href);

describe("service-worker never-cache rule (security audit M3)", () => {
  it("never caches anything from another origin, Supabase above all", () => {
    expect(isNeverCached(at("https://abc.supabase.co/auth/v1/user"), false)).toBe(true);
    expect(isNeverCached(at("https://abc.supabase.co/rest/v1/cities?select=*"), false)).toBe(true);
    expect(isNeverCached(at("https://abc.supabase.co/storage/v1/object/public/x.jpg"), false)).toBe(
      true,
    );
  });

  it("never caches signed-in or API pages on our own origin", () => {
    for (const path of [
      "/me",
      "/me/profile",
      "/delegate",
      "/admin/members",
      "/api/dev/otp",
      "/login",
      "/join",
      "/auth/callback",
    ]) {
      expect(isNeverCached(at(`https://site.test${path}`), true)).toBe(true);
    }
  });

  it("still lets public pages be cached", () => {
    for (const path of ["/", "/leaderboard", "/delegates/nino", "/members", "/meeting"]) {
      expect(isNeverCached(at(`https://site.test${path}`), true)).toBe(false);
    }
  });

  it("clears the caches that can hold personal data on sign-out, keeps code and the offline shell", () => {
    expect(
      runtimeCachesToClear([
        "serwist-precache-v2-https://site.test/",
        "next-static-js-assets",
        "static-js-assets",
        "static-style-assets",
        "static-font-assets",
        "cross-origin",
        "pages",
        "pages-rsc",
        "pages-rsc-prefetch",
        "others",
        "apis",
        "next-data",
        "static-data-assets",
        "static-image-assets",
        "next-image",
      ]),
    ).toEqual([
      "cross-origin",
      "pages",
      "pages-rsc",
      "pages-rsc-prefetch",
      "others",
      "apis",
      "next-data",
      "static-data-assets",
      "static-image-assets",
      "next-image",
    ]);
  });

  it("is the service worker's first runtime rule, ahead of defaultCache", () => {
    const sw = readFileSync("app/sw.ts", "utf8");
    const rule = sw.indexOf("matcher: ({ url, sameOrigin }) => isNeverCached(url, sameOrigin)");
    expect(rule).toBeGreaterThan(-1);
    expect(rule).toBeLessThan(sw.indexOf("...defaultCache"));
    expect(sw.indexOf("runtimeCaching: [")).toBeLessThan(rule);
  });

  it("drops the cache older workers filled with Supabase responses", () => {
    expect(readFileSync("app/sw.ts", "utf8")).toContain("caches.delete(LEGACY_CROSS_ORIGIN_CACHE)");
  });
});
