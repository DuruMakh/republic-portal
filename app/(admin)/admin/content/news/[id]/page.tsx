import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { ArticleActions } from "../ArticleActions";
import { CoverUpload } from "../CoverUpload";
import { NewsForm } from "../NewsForm";

export const metadata: Metadata = { title: "სიახლის რედაქტირება — ქართული რესპუბლიკა" };

export default async function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: article, error } = await supabase
    .from("admin_news")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`admin_news by id failed: ${error.message}`);
  if (!article) notFound();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-ink">სიახლის რედაქტირება</h1>
        <Pill {...contentPill(article.status)} />
        {article.slug && article.status === "published" ? (
          <a
            href={`/news/${article.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-brand hover:underline"
          >
            ნახე საიტზე ↗
          </a>
        ) : null}
      </div>

      <NewsForm
        article={{
          id: article.id,
          title: article.title,
          body: article.body,
          visibility: article.visibility,
        }}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted-fg">ყდის სურათი</h2>
          <CoverUpload newsId={article.id} imageUrl={article.image_url} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted-fg">მოქმედებები</h2>
          <ArticleActions
            id={article.id}
            status={article.status}
            everPublished={article.published_at !== null}
          />
        </div>
      </div>
    </div>
  );
}
