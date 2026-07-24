import type { Metadata } from "next";
import { DelegateDirectory } from "@/components/DelegateDirectory";
import { Eyebrow } from "@/components/Eyebrow";
import { formatCountKa } from "@/lib/format";
import { rankDelegates } from "@/lib/ranking";
import { fetchPublicDelegates, fetchRegions } from "@/lib/supabase/public";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "ჩვენი დელეგატები — ქართული რესპუბლიკა",
  description: "ყველა დელეგატი გადის იურიდიულ ვერიფიკაციას. ნახე, ვინ წარმოადგენს შენს რეგიონს.",
};

// Kicker/H1 spliced -- never hand-retyped -- from prototype/kronika-d3/kronika-d3-template.html
// lines 551-552 (the "· ტომი II" volume flourish dropped per spec §4.2 / the Task-12 brief).
// APPROVED_LABEL reused byte-exact from app/(public)/page.tsx's STAT_APPROVED_LABEL (same
// splice lineage, Task 11); REGION_WORD reused byte-exact from this page's own
// DelegateDirectory region-select aria-label. All spliced by scripts/task12-inject, per the
// georgian-quote-transcription-hazard note (never hand-retyped).
const DELEGATES_KICKER = "საჯარო რეესტრი";
const DELEGATES_H1 = "ჩვენი დელეგატები";
const APPROVED_LABEL = "დამტკიცებული დელეგატი";
const REGION_WORD = "მხარე";

export default async function DelegatesPage() {
  const [delegates, regions] = await Promise.all([fetchPublicDelegates(), fetchRegions()]);
  const ranked = rankDelegates(delegates);
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="border-b border-ink pb-[18px] text-center">
        <Eyebrow>{DELEGATES_KICKER}</Eyebrow>
        <h1 className="mt-2.5 font-serif text-4xl font-bold text-ink">{DELEGATES_H1}</h1>
        <p className="mt-2 text-[0.8rem] text-muted-fg">
          {formatCountKa(ranked.length)} {APPROVED_LABEL} · {formatCountKa(regions.length)}{" "}
          {REGION_WORD}
        </p>
      </div>
      <div className="mt-8">
        <DelegateDirectory delegates={ranked} regions={regions} />
      </div>
    </main>
  );
}
