import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/site", () => ({ siteUrl: () => "https://example.test" }));
const data = vi.hoisted(() => ({
  fetchPublicDelegates: vi.fn(async () => []),
  fetchPublicNews: vi.fn(),
  fetchPublicEvents: vi.fn(),
}));
vi.mock("@/lib/supabase/public", () => data);

function news(slug: string, published_at: string) {
  return { id: slug, slug, title: slug, body: "", image_url: null, published_at };
}

import sitemap from "./sitemap";

beforeEach(() => {
  vi.stubEnv("SHOW_RATINGS", undefined);
  vi.stubEnv("SHOW_ENGLISH", undefined);
  vi.stubEnv("SHOW_EVENTS", undefined);
  vi.stubEnv("SHOW_PUBLIC_FINANCES", undefined);
  data.fetchPublicNews.mockResolvedValue([]);
  data.fetchPublicEvents.mockResolvedValue([]);
});

const entry = (entries: Awaited<ReturnType<typeof sitemap>>, url: string) =>
  entries.find((e) => e.url === url);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sitemap", () => {
  it("lists only Georgian addresses while English is hidden", async () => {
    const entries = await sitemap();
    expect(entries.map((entry) => entry.url).filter((url) => url.includes("/en"))).toEqual([]);
    expect(entries.find((entry) => entry.url === "https://example.test/about")?.alternates).toBe(
      undefined,
    );
  });

  it("pairs English and Georgian public addresses without publishing hidden routes", async () => {
    vi.stubEnv("SHOW_ENGLISH", "true");
    const entries = await sitemap();
    expect(entries.map((entry) => entry.url)).toContain("https://example.test/en/principles");
    expect(entries.map((entry) => entry.url)).not.toContain("https://example.test/en/leaderboard");
    expect(
      entries.find((entry) => entry.url === "https://example.test/en/about")?.alternates?.languages,
    ).toEqual({ ka: "https://example.test/about", en: "https://example.test/en/about" });
  });
  it("lists the privacy policy like the delegate rules", async () => {
    const entries = await sitemap();
    expect(entries).toContainEqual(
      expect.objectContaining({
        url: "https://example.test/privacy",
        changeFrequency: "monthly",
        priority: 0.3,
      }),
    );
  });

  it("lists the about page", async () => {
    const entries = await sitemap();
    expect(entries).toContainEqual(
      expect.objectContaining({
        url: "https://example.test/about",
        changeFrequency: "monthly",
        priority: 0.7,
      }),
    );
  });

  it("leaves the ranking out while ratings are hidden, and lists it once they are on", async () => {
    const hidden = await sitemap();
    expect(hidden.map((e) => e.url)).not.toContain("https://example.test/leaderboard");
    vi.stubEnv("SHOW_RATINGS", "true");
    const shown = await sitemap();
    expect(shown.map((e) => e.url)).toContain("https://example.test/leaderboard");
  });

  it("lists every news article with its publication date", async () => {
    data.fetchPublicNews.mockResolvedValue([
      news("second", "2026-10-20T10:00:00Z"),
      news("first", "2026-10-01T09:00:00Z"),
    ]);
    const entries = await sitemap();
    expect(entry(entries, "https://example.test/news/second")).toEqual({
      url: "https://example.test/news/second",
      lastModified: new Date("2026-10-20T10:00:00Z"),
      changeFrequency: "monthly",
      priority: 0.6,
    });
    expect(entry(entries, "https://example.test/news/first")?.lastModified).toEqual(
      new Date("2026-10-01T09:00:00Z"),
    );
  });

  it("dates the homepage and the news list by the newest article", async () => {
    data.fetchPublicNews.mockResolvedValue([
      news("second", "2026-10-20T10:00:00Z"),
      news("first", "2026-10-01T09:00:00Z"),
    ]);
    const entries = await sitemap();
    const newest = new Date("2026-10-20T10:00:00Z");
    expect(entry(entries, "https://example.test")).toMatchObject({
      lastModified: newest,
      changeFrequency: "daily",
    });
    expect(entry(entries, "https://example.test/news")?.lastModified).toEqual(newest);
  });

  it("gives the homepage and the news list no date while there is no news", async () => {
    const entries = await sitemap();
    expect(entry(entries, "https://example.test")).not.toHaveProperty("lastModified");
    expect(entry(entries, "https://example.test/news")).not.toHaveProperty("lastModified");
  });

  it("still lists an article whose date cannot be read, without a date", async () => {
    data.fetchPublicNews.mockResolvedValue([news("odd", "not a date")]);
    const entries = await sitemap();
    expect(entry(entries, "https://example.test/news/odd")).toBeDefined();
    expect(entry(entries, "https://example.test/news/odd")).not.toHaveProperty("lastModified");
    expect(entry(entries, "https://example.test")).not.toHaveProperty("lastModified");
  });

  it("leaves events out while they are hidden, and lists them once they are on", async () => {
    data.fetchPublicEvents.mockResolvedValue([{ slug: "meeting" }]);
    const hidden = (await sitemap()).map((e) => e.url);
    expect(hidden.filter((url) => url.includes("/events"))).toEqual([]);
    expect(data.fetchPublicEvents).not.toHaveBeenCalled();
    vi.stubEnv("SHOW_EVENTS", "true");
    const shown = (await sitemap()).map((e) => e.url);
    expect(shown).toContain("https://example.test/events");
    expect(shown).toContain("https://example.test/events/meeting");
  });

  it("leaves the finance page out while finances are hidden, and lists it once they are on", async () => {
    expect((await sitemap()).map((e) => e.url)).not.toContain("https://example.test/transparency");
    vi.stubEnv("SHOW_PUBLIC_FINANCES", "true");
    expect((await sitemap()).map((e) => e.url)).toContain("https://example.test/transparency");
  });
});
