import { isProductionEnv } from "./env";

/** Absolute origin for metadata/OG/sitemap. Env-driven, no request context. */
export function siteUrl(): string {
  if (isProductionEnv() && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
