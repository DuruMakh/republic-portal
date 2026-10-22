import type { MetadataRoute } from "next";
import { showEnglish } from "@/lib/english-switch";
import { showEvents } from "@/lib/events-switch";
import { showPublicFinances } from "@/lib/public-finances";
import { showRatings } from "@/lib/ratings-switch";
import { siteUrl } from "@/lib/site";
import { fetchPublicDelegates, fetchPublicEvents, fetchPublicNews } from "@/lib/supabase/public";
import { localePath } from "@/lib/i18n/routing";

export const revalidate = 3600;

/** A readable date as the entry's last change; nothing at all for a missing or broken one. */
function lastModifiedOf(iso: string | undefined): { lastModified: Date } | Record<string, never> {
  const date = iso ? new Date(iso) : undefined;
  return date && !Number.isNaN(date.getTime()) ? { lastModified: date } : {};
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  // hidden by default (ADR-042): the events data is not even read while the switch is off
  const [delegates, news, events] = await Promise.all([
    fetchPublicDelegates(),
    fetchPublicNews(),
    showEvents() ? fetchPublicEvents() : Promise.resolve([]),
  ]);
  const newest = news
    .map((n) => lastModifiedOf(n.published_at).lastModified)
    .filter((date): date is Date => date !== undefined)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const latestNews = newest ? { lastModified: newest } : {};
  const entries: MetadataRoute.Sitemap = [
    { url: base, ...latestNews, changeFrequency: "daily", priority: 1 },
    // hidden by default (ADR-052): a 404 does not belong in the sitemap
    ...(showRatings()
      ? [{ url: `${base}/leaderboard`, changeFrequency: "hourly" as const, priority: 0.9 }]
      : []),
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/structure`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/principles`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/news`, ...latestNews, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/support`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/join`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/join/terms`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "monthly", priority: 0.3 },
    // hidden by default (ADR-034)
    ...(showPublicFinances()
      ? [{ url: `${base}/transparency`, changeFrequency: "daily" as const, priority: 0.5 }]
      : []),
    ...(showEvents()
      ? [{ url: `${base}/events`, changeFrequency: "daily" as const, priority: 0.6 }]
      : []),
    ...news.map((n) => ({
      url: `${base}/news/${n.slug}`,
      ...lastModifiedOf(n.published_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...events.map((e) => ({
      url: `${base}/events/${e.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...delegates.map((d) => ({
      url: `${base}/delegates/${d.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
  // hidden by default (owner decision 2026-10-20): /en addresses redirect, so they stay out too
  if (!showEnglish()) return entries;
  return entries.flatMap((entry) => {
    const en = `${base}${localePath(entry.url.slice(base.length) || "/", "en")}`;
    const alternates = { languages: { ka: entry.url, en } };
    return [
      { ...entry, alternates },
      { ...entry, url: en, alternates },
    ];
  });
}
