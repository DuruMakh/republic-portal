import type { Metadata } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  fetchPublicNews: vi.fn(),
  fetchPublicNewsBySlug: vi.fn(),
  fetchPublicStats: vi.fn(),
  fetchPublicEvents: vi.fn(),
  fetchPublicEventBySlug: vi.fn(),
  fetchTransparencyStats: vi.fn(),
  fetchTransparencyRegions: vi.fn(),
}));
vi.mock("@/lib/supabase/public", () => data);
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));
// The sign-up page's form pulls in server-only modules (phone verification).
vi.mock("server-only", () => ({}));

import { ABOUT_SEO_DESCRIPTION } from "@/lib/about-copy";
import { HOME_SEO_DESCRIPTION, HOME_SEO_TITLE } from "@/lib/home-copy";
import { PRINCIPLES_LEDE } from "@/lib/principles-copy";
import { STRUCTURE_INTRO } from "@/lib/structure-copy";
import { SUPPORT_LEDE } from "@/lib/support-copy";
import { generateMetadata as homeMetadata } from "./page";
import { generateMetadata as aboutMetadata } from "./about/page";
import { generateMetadata as structureMetadata } from "./structure/page";
import { generateMetadata as principlesMetadata } from "./principles/page";
import { generateMetadata as supportMetadata } from "./support/page";
import { generateMetadata as joinMetadata } from "./join/page";
import { generateMetadata as newsMetadata } from "./news/page";
import { generateMetadata as newsArticleMetadata } from "./news/[slug]/page";
import { generateMetadata as eventsMetadata } from "./events/page";
import { generateMetadata as eventMetadata } from "./events/[slug]/page";
import { generateMetadata as transparencyMetadata } from "./transparency/page";

const slug = Promise.resolve({ slug: "story" });

beforeEach(() => {
  vi.stubEnv("SHOW_ENGLISH", undefined);
  vi.stubEnv("SHOW_EVENTS", "true");
  vi.stubEnv("SHOW_PUBLIC_FINANCES", "true");
  data.fetchPublicNewsBySlug.mockResolvedValue({
    id: "n1",
    slug: "story",
    title: "სიახლის სათაური",
    body: "სიახლის ტექსტი.",
    image_url: null,
    published_at: "2026-10-20T10:00:00Z",
  });
  data.fetchPublicEventBySlug.mockResolvedValue({
    id: "e1",
    slug: "story",
    title: "შეხვედრა",
    description: "შეხვედრის აღწერა.",
    location: "თბილისი",
    starts_at: "2026-11-01T15:00:00Z",
    ends_at: null,
    status: "published",
    published_at: "2026-10-20T10:00:00Z",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("home metadata", () => {
  it("says what the platform is and names its own address", async () => {
    const metadata = await homeMetadata();
    expect(metadata.title).toBe(HOME_SEO_TITLE);
    expect(metadata.description).toBe(HOME_SEO_DESCRIPTION);
    expect(metadata.alternates?.canonical).toBe("/");
  });
});

describe.each<[string, () => Promise<Metadata>, string]>([
  ["/about", aboutMetadata, ABOUT_SEO_DESCRIPTION],
  ["/structure", structureMetadata, STRUCTURE_INTRO],
  ["/principles", principlesMetadata, PRINCIPLES_LEDE],
  ["/support", supportMetadata, SUPPORT_LEDE],
])("%s metadata", (_route, metadata, description) => {
  it("carries the page's own description, not the site-wide fallback", async () => {
    const resolved = await metadata();
    expect(resolved.description).toEqual(expect.any(String));
    expect(resolved.description).toBe(description);
    expect(resolved.description).not.toBe("სამოქალაქო პორტალი");
  });
});

describe("/join metadata", () => {
  it("names its own address", async () => {
    expect((await joinMetadata()).alternates?.canonical).toBe("/join");
  });
});

describe.each<[string, () => Promise<Metadata>]>([
  ["/join", joinMetadata],
  ["/news", newsMetadata],
  ["/news/[slug]", () => newsArticleMetadata({ params: slug })],
  ["/events", eventsMetadata],
  ["/events/[slug]", () => eventMetadata({ params: slug })],
  ["/transparency", transparencyMetadata],
])("%s share preview", (_route, metadata) => {
  it("keeps the site name and the Georgian locale next to its own preview settings", async () => {
    const openGraph = (await metadata()).openGraph;
    expect(openGraph).toMatchObject({ siteName: "ქართული რესპუბლიკა", locale: "ka_GE" });
  });
});

describe("/news/[slug] share preview", () => {
  it("stays an article", async () => {
    const openGraph = (await newsArticleMetadata({ params: slug })).openGraph;
    expect(openGraph).toMatchObject({ type: "article" });
  });
});
