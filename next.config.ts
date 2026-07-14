import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/delegates/[slug]/opengraph-image": ["./assets/fonts/*.ttf"],
  },
};

export default nextConfig;
