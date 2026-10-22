import { describe, expect, it } from "vitest";
import { newsArticleJsonLd, organizationJsonLd, websiteJsonLd } from "./structured-data";

const base = "https://example.test";

const article = {
  slug: "story",
  title: "სიახლის სათაური",
  body: "ტექსტი",
  image_url: null,
  published_at: "2026-10-20T10:00:00Z",
};

describe("organizationJsonLd", () => {
  it("names the organisation, its address and its emblem", () => {
    expect(organizationJsonLd(base)).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "ქართული რესპუბლიკა",
      url: "https://example.test",
      logo: "https://example.test/icons/icon-512.png",
    });
  });
});

describe("websiteJsonLd", () => {
  it("names the site, its address and its language", () => {
    expect(websiteJsonLd(base)).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "ქართული რესპუბლიკა",
      url: "https://example.test",
      inLanguage: "ka",
    });
  });
});

describe("newsArticleJsonLd", () => {
  it("describes the article with the organisation as publisher", () => {
    expect(newsArticleJsonLd(base, article)).toEqual({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: "სიახლის სათაური",
      datePublished: "2026-10-20T10:00:00Z",
      url: "https://example.test/news/story",
      image: "https://example.test/og-default.png?v=civic-portal",
      publisher: {
        "@type": "Organization",
        name: "ქართული რესპუბლიკა",
        url: "https://example.test",
        logo: "https://example.test/icons/icon-512.png",
      },
    });
  });

  it("makes a site-relative image absolute and leaves an absolute one alone", () => {
    expect(newsArticleJsonLd(base, { ...article, image_url: "/uploads/a.jpg" }).image).toBe(
      "https://example.test/uploads/a.jpg",
    );
    expect(
      newsArticleJsonLd(base, { ...article, image_url: "https://cdn.example/a.jpg" }).image,
    ).toBe("https://cdn.example/a.jpg");
  });

  it("cuts a long title to the 110 characters search engines read", () => {
    const headline = newsArticleJsonLd(base, { ...article, title: "ა".repeat(200) }).headline;
    expect(headline).toBe("ა".repeat(110));
  });
});
