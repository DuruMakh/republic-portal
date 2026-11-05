/**
 * schema.org descriptions for search engines (JSON-LD): the organisation and the website on the
 * homepage, each published story on its own page. Rendered by components/JsonLd.tsx.
 */
import type { PublicNewsItem } from "@/lib/supabase/public";

export type JsonLdObject = { "@context": "https://schema.org"; "@type": string } & Record<
  string,
  unknown
>;

const NAME = "ქართული რესპუბლიკა";
const DEFAULT_IMAGE = "/og-default.png?v=civic-portal";
/** Google reads at most this many characters of a headline. */
const HEADLINE_LENGTH = 110;

function organization(base: string) {
  return { "@type": "Organization", name: NAME, url: base, logo: `${base}/icons/icon-512.png` };
}

export function organizationJsonLd(base: string): JsonLdObject {
  return { "@context": "https://schema.org", ...organization(base) };
}

export function websiteJsonLd(base: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: NAME,
    url: base,
    inLanguage: "ka",
  };
}

export function newsArticleJsonLd(
  base: string,
  article: Pick<PublicNewsItem, "slug" | "title" | "body" | "image_url" | "published_at">,
): JsonLdObject {
  const image = article.image_url ?? DEFAULT_IMAGE;
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: Array.from(article.title).slice(0, HEADLINE_LENGTH).join(""),
    datePublished: article.published_at,
    url: `${base}/news/${article.slug}`,
    // site-relative only: a protocol-relative //host/... address already names its host
    image: /^\/(?!\/)/.test(image) ? `${base}${image}` : image,
    publisher: organization(base),
  };
}
