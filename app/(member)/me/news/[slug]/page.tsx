import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContentBody } from "@/components/ContentBody";
import { Pill } from "@/components/Pill";
import { formatDateKa } from "@/lib/cabinet";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "სიახლე — ქართული რესპუბლიკა" };

interface ArticleView {
  title: string;
  body: string;
  imageUrl: string | null;
  publishedAt: string;
  membersOnly: boolean;
}

/**
 * Source switch (spec §4.2): same rule as the list page. A registered caller
 * opening a members-only slug gets zero rows from public_news → notFound()
 * below handles it exactly like an unknown slug (no separate branch needed).
 */
export default async function MemberArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabase();
  const state = await getCabinetState();
  if (!state.exists) redirect("/join"); // soft-nav defense: narrow before the completed branch

  let article: ArticleView | null;
  if (state.completed) {
    const { data, error } = await supabase
      .from("member_news")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(`member_news by slug failed: ${error.message}`);
    article = data
      ? {
          title: data.title,
          body: data.body,
          imageUrl: data.image_url,
          publishedAt: data.published_at,
          membersOnly: data.visibility === "members",
        }
      : null;
  } else {
    const { data, error } = await supabase
      .from("public_news")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(`public_news by slug failed: ${error.message}`);
    article = data
      ? {
          title: data.title,
          body: data.body,
          imageUrl: data.image_url,
          publishedAt: data.published_at,
          membersOnly: false,
        }
      : null;
  }
  if (!article) notFound();

  return (
    <main className="mx-auto max-w-3xl">
      <Link href="/me/news" className="text-sm font-semibold text-brand hover:underline">
        ← სიახლეები
      </Link>
      <article className="mt-6">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted-fg">
          <span>{formatDateKa(article.publishedAt)}</span>
          {article.membersOnly ? <Pill status="profile_completed" label="წევრებისთვის" /> : null}
        </div>
        <h1 className="mt-2 text-3xl font-bold text-ink">{article.title}</h1>
        {article.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage host not in next.config images (delegate-photo precedent)
          <img
            src={article.imageUrl}
            alt=""
            className="mt-6 w-full rounded-xl border border-line object-cover"
          />
        ) : null}
        <ContentBody body={article.body} className="mt-6" />
      </article>
    </main>
  );
}
