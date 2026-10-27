import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/AdminUi";
import { notFound } from "next/navigation";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { NewsEditor } from "../NewsEditor";

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

      <NewsEditor
        article={{
          id: article.id,
          title: article.title,
          body: article.body,
          visibility: article.visibility,
        }}
        status={article.status}
        everPublished={article.published_at !== null}
        imageUrl={article.image_url}
      />
    </div>
  );
}
