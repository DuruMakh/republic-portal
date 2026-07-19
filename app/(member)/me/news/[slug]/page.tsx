import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentBody } from "@/components/ContentBody";
import { Pill } from "@/components/Pill";
import { formatDateKa } from "@/lib/cabinet";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "სიახლე — ქართული რესპუბლიკა" };

export default async function MemberArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabase();
  const { data: article, error } = await supabase
    .from("member_news")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`member_news by slug failed: ${error.message}`);
  if (!article) notFound();

  return (
    <main className="mx-auto max-w-3xl">
      <Link href="/me/news" className="text-sm font-semibold text-brand hover:underline">
        ← სიახლეები
      </Link>
      <article className="mt-6">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted-fg">
          <span>{formatDateKa(article.published_at)}</span>
          {article.visibility === "members" ? (
            <Pill status="profile_completed" label="წევრებისთვის" />
          ) : null}
        </div>
        <h1 className="mt-2 text-3xl font-bold text-ink">{article.title}</h1>
        {article.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage host not in next.config images (delegate-photo precedent)
          <img
            src={article.image_url}
            alt=""
            className="mt-6 w-full rounded-xl border border-line object-cover"
          />
        ) : null}
        <ContentBody body={article.body} className="mt-6" />
      </article>
    </main>
  );
}
