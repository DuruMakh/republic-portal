import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewsCard } from "@/components/NewsCard";
import { Pill } from "@/components/Pill";
import { excerpt } from "@/lib/content-render";
import { formatDateKa } from "@/lib/cabinet";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "სიახლეები — ქართული რესპუბლიკა" };

interface NewsListItem {
  id: string;
  slug: string;
  title: string;
  body: string;
  imageUrl: string | null;
  publishedAt: string;
  membersOnly: boolean;
}

/**
 * Source switch (spec §4.2, D3): member standing sees member_news (public +
 * members-only, with the visibility pill); registered standing sees
 * public_news only — member_news self-gates via is_completed_member() and
 * would silently return zero rows for a registered caller.
 */
export default async function MemberNewsPage() {
  const supabase = await createServerSupabase();
  const state = await getCabinetState();
  if (!state.exists) redirect("/join"); // soft-nav defense: narrow before the completed branch

  let items: NewsListItem[];
  if (state.completed) {
    const { data, error } = await supabase
      .from("member_news")
      .select("*")
      .order("published_at", { ascending: false });
    if (error) throw new Error(`member_news failed: ${error.message}`);
    items = (data ?? []).map((n) => ({
      id: n.id,
      slug: n.slug,
      title: n.title,
      body: n.body,
      imageUrl: n.image_url,
      publishedAt: n.published_at,
      membersOnly: n.visibility === "members",
    }));
  } else {
    const { data, error } = await supabase
      .from("public_news")
      .select("*")
      .order("published_at", { ascending: false });
    if (error) throw new Error(`public_news failed: ${error.message}`);
    items = (data ?? []).map((n) => ({
      id: n.id,
      slug: n.slug,
      title: n.title,
      body: n.body,
      imageUrl: n.image_url,
      publishedAt: n.published_at,
      membersOnly: false,
    }));
  }

  return (
    <main>
      <h1 className="text-2xl font-bold text-ink">სიახლეები</h1>
      <p className="mt-1 text-sm text-muted-fg">
        {state.completed
          ? "მოძრაობის სიახლეები — წევრებისთვის განკუთვნილი მასალების ჩათვლით."
          : "მოძრაობის საჯარო სიახლეები."}
      </p>
      {items.length === 0 ? (
        <p className="mt-8 text-muted-fg">სიახლეები მალე გამოჩნდება.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {items.map((n) => (
            <NewsCard
              key={n.id}
              href={n.membersOnly ? `/me/news/${n.slug}` : `/news/${n.slug}`}
              title={n.title}
              publishedAt={formatDateKa(n.publishedAt)}
              imageUrl={n.imageUrl}
              excerptText={excerpt(n.body)}
              pill={
                n.membersOnly ? <Pill status="profile_completed" label="წევრებისთვის" /> : undefined
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
