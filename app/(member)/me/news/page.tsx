import type { Metadata } from "next";
import { NewsCard } from "@/components/NewsCard";
import { Pill } from "@/components/Pill";
import { excerpt } from "@/lib/content-render";
import { formatDateKa } from "@/lib/cabinet";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "სიახლეები — ქართული რესპუბლიკა" };

export default async function MemberNewsPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("member_news")
    .select("*")
    .order("published_at", { ascending: false });
  if (error) throw new Error(`member_news failed: ${error.message}`);
  const items = data ?? [];

  return (
    <main>
      <h1 className="text-2xl font-bold text-ink">სიახლეები</h1>
      <p className="mt-1 text-sm text-muted-fg">
        მოძრაობის სიახლეები — წევრებისთვის განკუთვნილი მასალების ჩათვლით.
      </p>
      {items.length === 0 ? (
        <p className="mt-8 text-muted-fg">სიახლეები მალე გამოჩნდება.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {items.map((n) => (
            <NewsCard
              key={n.id}
              href={n.visibility === "members" ? `/me/news/${n.slug}` : `/news/${n.slug}`}
              title={n.title}
              publishedAt={formatDateKa(n.published_at)}
              imageUrl={n.image_url}
              excerptText={excerpt(n.body)}
              pill={
                n.visibility === "members" ? (
                  <Pill status="profile_completed" label="წევრებისთვის" />
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
