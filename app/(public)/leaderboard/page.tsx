import type { Metadata } from "next";
import { Badge } from "@/components/Badge";
import { Eyebrow } from "@/components/Eyebrow";
import { LeaderRow } from "@/components/LeaderRow";
import { SectionRule } from "@/components/SectionRule";
import { formatCountKa } from "@/lib/format";
import { rankDelegates } from "@/lib/ranking";
import { fetchPublicDelegates } from "@/lib/supabase/public";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "დელეგატების რეიტინგი — ქართული რესპუბლიკა",
  description: "ავტომატურად ლაგდება აქტიური გადამხდელი მხარდამჭერების მიხედვით.",
};

// Reused byte-exact from the shipped Card `header` heading (git history) -- spliced by
// scripts/task12-inject, never hand-retyped. Moved into SectionRule's `label` because Card's
// `header` slot is a bare small-caps label now (Task 4), not a title+action row -- see the
// task-12 brief's Card-header-carry note.
const SECTION_HEADING = "ცოცხალი რეიტინგი";

export default async function LeaderboardPage() {
  const ranked = rankDelegates(await fetchPublicDelegates());
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-2">
        <Eyebrow>ლიდერბორდი</Eyebrow>
      </div>
      <h1 className="font-serif text-4xl font-bold text-ink">დელეგატების რეიტინგი</h1>
      <p className="mt-3 text-muted-fg">
        ავტომატურად ლაგდება აქტიური გადამხდელი მხარდამჭერების მიხედვით.
      </p>
      <div className="mt-8">
        <SectionRule
          label={SECTION_HEADING}
          action={<Badge>{formatCountKa(ranked.length)} დელეგატი</Badge>}
        />
        <ol className="list-none" role="list">
          {ranked.map((d) => (
            <li key={d.id}>
              <LeaderRow delegate={d} />
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-4 text-center text-xs text-muted-fg/80">
        რეიტინგი ახლდება ავტომატურად ყოველი ახალი აქტიური მხარდამჭერის დამატებისას.
      </p>
    </main>
  );
}
