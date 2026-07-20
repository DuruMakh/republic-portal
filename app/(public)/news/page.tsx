import type { Metadata } from "next";
import { Eyebrow } from "@/components/Eyebrow";
import { NewsCard } from "@/components/NewsCard";
import { excerpt } from "@/lib/content-render";
import { formatDateKa } from "@/lib/cabinet";
import { fetchPublicNews } from "@/lib/supabase/public";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "სიახლეები — ქართული რესპუბლიკა",
  description: "მოძრაობის სიახლეები და განცხადებები.",
  openGraph: { images: ["/og-default.png"] },
};

export default async function NewsPage() {
  const news = await fetchPublicNews();
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>ქართული რესპუბლიკა</Eyebrow>
      <h1 className="mt-1 font-serif text-4xl font-bold text-ink">სიახლეები</h1>
      {news.length === 0 ? (
        <p className="mt-8 text-muted-fg">სიახლეები მალე გამოჩნდება.</p>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {news.map((n) => (
            <NewsCard
              key={n.id}
              href={`/news/${n.slug}`}
              title={n.title}
              publishedAt={formatDateKa(n.published_at)}
              imageUrl={n.image_url}
              excerptText={excerpt(n.body)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
