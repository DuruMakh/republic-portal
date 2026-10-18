import type { NextConfig } from "next";
import { showRatings } from "./lib/ratings-switch";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/delegates/\\[slug\\]/opengraph-image": ["./assets/fonts/*.ttf"],
  },
  experimental: {
    // photo upload (admin delegate editor) sends up to 5 MB through a server
    // action; Next's default body cap is 1 MB. 6mb leaves headroom for the
    // multipart envelope. Scope stays global-but-harmless: every other action
    // in the app carries tiny payloads.
    serverActions: { bodySizeLimit: "6mb" },
    // Vercel restores Turbopack's saved build cache between deploys. On 2026-10-16 it served
    // styles built from the previous app/globals.css (new colours and fonts missing on the
    // live site), so every production build starts clean.
    turbopackFileSystemCacheForBuild: false,
  },
  async redirects() {
    // Owner fix #3: the delegates index duplicated რეიტინგი and retired into it.
    // EXACT source only — /delegates/<slug> profile pages must keep resolving.
    // While ratings are hidden (ADR-052) there is no ranking to send anyone to, and a cached
    // permanent redirect into a 404 would outlive the switch: /delegates is a plain 404 then.
    if (!showRatings()) return [];
    return [
      { source: "/delegates", destination: "/leaderboard", permanent: true },
      { source: "/en/delegates", destination: "/en/leaderboard", permanent: true },
    ];
  },
};

export default createNextIntlPlugin("./lib/i18n/request.ts")(nextConfig);
