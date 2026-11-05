import type { Metadata } from "next";
import { isProductionEnv } from "./env";

/** Absolute origin for metadata/OG/sitemap. Env-driven, no request context. */
export function siteUrl(): string {
  if (isProductionEnv() && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** The Google Search Console ownership tag, only when GOOGLE_SITE_VERIFICATION holds a code. */
export function siteVerification(): Pick<Metadata, "verification"> {
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  return google ? { verification: { google } } : {};
}
