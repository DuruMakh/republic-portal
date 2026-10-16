import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { AdminPageHeader, AdminSectionTitle } from "@/components/AdminUi";
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
      <AdminPageHeader
        title="სიახლის რედაქტირება"
        meta={
          <>
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
          </>
        }
      />

      <NewsForm
        article={{
          id: article.id,
          title: article.title,
          body: article.body,
          visibility: article.visibility,
        }}
      />

      <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card>
          <AdminSectionTitle className="mb-5">ყდის სურათი</AdminSectionTitle>
          <CoverUpload newsId={article.id} imageUrl={article.image_url} />
        </Card>
        <Card>
          <AdminSectionTitle className="mb-5">მოქმედებები</AdminSectionTitle>
          <ArticleActions
            id={article.id}
            status={article.status}
            everPublished={article.published_at !== null}
          />
        </Card>
      </div>
    </div>
  );
}
