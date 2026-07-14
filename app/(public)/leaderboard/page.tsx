import type { Metadata } from "next";
import { LeaderRow } from "@/components/LeaderRow";
import { formatCountKa } from "@/lib/format";
import { rankDelegates } from "@/lib/ranking";
import { fetchPublicDelegates } from "@/lib/supabase/public";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "დელეგატების რეიტინგი — ქართული რესპუბლიკა",
  description: "ავტომატურად ლაგდება აქტიური გადამხდელი მხარდამჭერების მიხედვით.",
};

export default async function LeaderboardPage() {
  const ranked = rankDelegates(await fetchPublicDelegates());
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-brand">
        ლიდერბორდი
      </div>
      <h1 className="font-serif text-4xl font-bold text-ink">დელეგატების რეიტინგი</h1>
      <p className="mt-3 text-muted-fg">
        ავტომატურად ლაგდება აქტიური გადამხდელი მხარდამჭერების მიხედვით.
      </p>
      <div className="mt-8 overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          <h2 className="font-bold text-ink">ცოცხალი რეიტინგი</h2>
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-muted-fg">
            {formatCountKa(ranked.length)} დელეგატი
          </span>
        </div>
        {ranked.map((d) => (
          <LeaderRow key={d.id} delegate={d} />
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted-fg/80">
        რეიტინგი ახლდება ავტომატურად ყოველი ახალი აქტიური მხარდამჭერის დამატებისას.
      </p>
    </main>
  );
}
