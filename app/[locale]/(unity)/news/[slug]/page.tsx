import { getCopy, getLocale } from "@/lib/i18n/server";
import { languageAlternates } from "@/lib/i18n/metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentBody } from "@/components/ContentBody";
import { UnityClosing } from "@/components/UnityClosing";
import { UnityArticleHead } from "@/components/UnityPageHead";
import { UnityTextLink } from "@/components/UnityTextLink";
import { excerpt } from "@/lib/content-render";
import { formatDate } from "@/lib/i18n/format";
import { CONTACT_CLOSING_LINK } from "@/lib/public-pages-copy";
import { fetchPublicNews, fetchPublicNewsBySlug } from "@/lib/supabase/public";
import { generateMetadata as notFoundMetadata } from "./not-found";

export const revalidate = 60;

const BACK = "← სიახლეები";

export async function generateStaticParams() {
  const news = await fetchPublicNews();
  return news.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const t = await getCopy();
  const { slug } = await params;
  const article = await fetchPublicNewsBySlug(slug);
  if (!article) return notFoundMetadata();
  return {
    title: `${article.title} — ${t("ქართული რესპუბლიკა")}`,
    description: excerpt(article.body),
    openGraph: {
      type: "article",
      title: article.title,
      description: excerpt(article.body),
      images: [article.image_url ?? "/og-default.png?v=civic-portal"],
    },
    ...languageAlternates(`/news/${slug}`, await getLocale()),
  };
}

export default async function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getCopy();
  const locale = await getLocale();
  const { slug } = await params;
  const article = await fetchPublicNewsBySlug(slug);
  if (!article) notFound();

  return (
    <main aria-labelledby="page-title">
      <section className="pb-16 pt-7 sm:pb-[clamp(88px,9vw,136px)] sm:pt-[clamp(56px,6vw,88px)]">
        <div className="unity-container">
          <article>
            <div className="mx-auto max-w-[860px]">
              <UnityArticleHead
                backHref="/news"
                backLabel={t(BACK)}
                kicker={formatDate(article.published_at, locale)}
                title={article.title}
              />
            </div>
            {article.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage host not in next.config images (delegate-photo precedent)
              <img
                src={article.image_url}
                lang="ka"
                alt={article.title}
                className="mx-auto mt-[26px] block aspect-[3/2] w-full max-w-[1080px] bg-sandstone object-cover sm:mt-12 sm:aspect-[21/9] sm:max-h-[460px]"
              />
            ) : null}
            <div className="mx-auto mt-7 max-w-[720px] sm:mt-[52px]">
              <div lang="ka">
                <ContentBody body={article.body} reading />
              </div>
              <div className="mt-9 border-t border-rule pt-[22px] sm:pt-[26px]">
                <UnityTextLink href="/news" className="text-[15px] font-bold sm:text-[16px]">
                  {t(BACK)}
                </UnityTextLink>
              </div>
            </div>
          </article>
        </div>
      </section>
      <UnityClosing link={CONTACT_CLOSING_LINK} />
    </main>
  );
}
