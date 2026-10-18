import type { MetadataRoute } from "next";
import { showRatings } from "@/lib/ratings-switch";
import { siteUrl } from "@/lib/site";
import { fetchPublicDelegates } from "@/lib/supabase/public";
import { localePath } from "@/lib/i18n/routing";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const delegates = await fetchPublicDelegates();
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "hourly", priority: 1 },
    // hidden by default (ADR-052): a 404 does not belong in the sitemap
    ...(showRatings()
      ? [{ url: `${base}/leaderboard`, changeFrequency: "hourly" as const, priority: 0.9 }]
      : []),
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/structure`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/principles`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/news`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/support`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/join`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/join/terms`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "monthly", priority: 0.3 },
    ...delegates.map((d) => ({
      url: `${base}/delegates/${d.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
  return entries.flatMap((entry) => {
    const en = `${base}${localePath(entry.url.slice(base.length) || "/", "en")}`;
    const alternates = { languages: { ka: entry.url, en } };
    return [
      { ...entry, alternates },
      { ...entry, url: en, alternates },
    ];
  });
}
