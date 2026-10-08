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
    ]) {
      expect(isNeverCached(at(`https://site.test${path}`), true)).toBe(true);
    }
  });

  it("still lets public pages be cached", () => {
    for (const path of ["/", "/leaderboard", "/delegates/nino", "/members", "/meeting"]) {
      expect(isNeverCached(at(`https://site.test${path}`), true)).toBe(false);
    }
  });

  it("clears runtime caches on sign-out but keeps the offline precache", () => {
    expect(
      runtimeCachesToClear([
        "serwist-precache-v2-https://site.test/",
        "cross-origin",
        "pages",
        "apis",
      ]),
    ).toEqual(["cross-origin", "pages", "apis"]);
  });
});
