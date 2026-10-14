import type { NextConfig } from "next";
import { showRatings } from "./lib/ratings-switch";

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
  },
  async redirects() {
    // Owner fix #3: the delegates index duplicated რეიტინგი and retired into it.
    // EXACT source only — /delegates/<slug> profile pages must keep resolving.
    // While ratings are hidden (ADR-052) there is no ranking to send anyone to, and a cached
    // permanent redirect into a 404 would outlive the switch: /delegates is a plain 404 then.
    if (!showRatings()) return [];
    return [{ source: "/delegates", destination: "/leaderboard", permanent: true }];
  },
};

export default nextConfig;
