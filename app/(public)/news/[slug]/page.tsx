import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentBody } from "@/components/ContentBody";
import { Eyebrow } from "@/components/Eyebrow";
import { excerpt } from "@/lib/content-render";
import { formatDateKa } from "@/lib/cabinet";
import { fetchPublicNews, fetchPublicNewsBySlug } from "@/lib/supabase/public";

export const revalidate = 60;

export async function generateStaticParams() {
  const news = await fetchPublicNews();
  return news.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchPublicNewsBySlug(slug);
  if (!article) return { title: "სიახლე ვერ მოიძებნა — ქართული რესპუბლიკა" };
  return {
    title: `${article.title} — ქართული რესპუბლიკა`,
    description: excerpt(article.body),
    openGraph: {
      type: "article",
      title: article.title,
      description: excerpt(article.body),
      images: [article.image_url ?? "/og-default.png"],
    },
  };
}

export default async function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await fetchPublicNewsBySlug(slug);
  if (!article) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/news" className="text-sm font-semibold text-brand hover:underline">
        ← სიახლეები
      </Link>
      <article className="mt-6">
        <Eyebrow>{formatDateKa(article.published_at)}</Eyebrow>
        <h1 className="mt-1 font-serif text-4xl font-bold text-ink">{article.title}</h1>
        {article.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage host not in next.config images (delegate-photo precedent)
          <img
            src={article.image_url}
            alt={article.title}
            className="mt-6 w-full rounded-xl border border-line object-cover"
          />
        ) : null}
        <ContentBody body={article.body} className="mt-6" />
      </article>
    </main>
  );
}
