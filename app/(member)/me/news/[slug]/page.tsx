import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CabinetPage } from "@/components/CabinetPage";
import { ContentBody } from "@/components/ContentBody";
import { Pill } from "@/components/Pill";
import { UnityKicker } from "@/components/UnityKicker";
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
    <CabinetPage>
      <div className="mx-auto max-w-[860px]">
        <Link
          href="/me/news"
          className="text-[15px] font-bold text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
        >
          ← სიახლეები
        </Link>
        <article className="mt-8 md:mt-10">
          <div className="border-b border-ink pb-6 md:pb-7">
            <div className="flex flex-wrap items-center gap-3.5">
              <UnityKicker>{formatDateKa(article.publishedAt)}</UnityKicker>
              {article.membersOnly ? (
                <Pill status="profile_completed" label="წევრებისთვის" />
              ) : null}
            </div>
            <h1 className="mt-5 mb-0 text-balance font-serif text-[32px] font-semibold leading-[1.2] text-ink md:text-[clamp(40px,4.4vw,58px)]">
              {article.title}
            </h1>
          </div>
          {article.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage host not in next.config images (delegate-photo precedent)
            <img src={article.imageUrl} alt="" className="mt-9 w-full object-cover" />
          ) : null}
          <ContentBody
            body={article.body}
            className="mt-9 max-w-[42em] md:mt-12 [&_p]:font-serif [&_p]:text-[17px] [&_p]:leading-[1.75] [&_p]:text-prose md:[&_p]:text-[19px]"
          />
        </article>
      </div>
    </CabinetPage>
  );
}
