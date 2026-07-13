/** Absolute origin for metadata/OG/sitemap. Env-driven, no request context. */
export function siteUrl(): string {
  if (
    process.env.NEXT_PUBLIC_APP_ENV === "production" &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  ) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
