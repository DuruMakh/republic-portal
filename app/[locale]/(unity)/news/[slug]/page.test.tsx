import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/public", () => ({
  fetchPublicNews: vi.fn(async () => []),
  fetchPublicNewsBySlug: vi.fn(async () => ({
    id: "n1",
    slug: "story",
    title: "სიახლის სათაური",
    body: "სიახლის ტექსტი.",
    image_url: null,
    published_at: "2026-10-20T10:00:00Z",
  })),
}));

import NewsArticlePage from "./page";

describe("/news/[slug] structured data", () => {
  it("describes the story as a news article", async () => {
    const { container } = render(
      await NewsArticlePage({ params: Promise.resolve({ slug: "story" }) }),
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(script?.textContent ?? "{}")).toMatchObject({
      "@type": "NewsArticle",
      headline: "სიახლის სათაური",
      datePublished: "2026-10-20T10:00:00Z",
    });
  });
});
