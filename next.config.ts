import type { NextConfig } from "next";

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
};

export default nextConfig;
