import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { fetchPublicDelegates } from "@/lib/supabase/public";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const delegates = await fetchPublicDelegates();
  return [
    { url: base, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/delegates`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/leaderboard`, changeFrequency: "hourly", priority: 0.9 },
    ...delegates.map((d) => ({
      url: `${base}/delegates/${d.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
