import { languageAlternates } from "@/lib/i18n/metadata";
import { getCopy, getLocale } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { Badge } from "@/components/Badge";
import { Eyebrow } from "@/components/Eyebrow";
import { LeaderboardDirectory } from "@/components/LeaderboardDirectory";
import { SectionRule } from "@/components/SectionRule";
import { formatCountKa } from "@/lib/format";
import { rankDelegates } from "@/lib/ranking";
import { fetchPublicDelegates, fetchRegions } from "@/lib/supabase/public";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  return {
    title: t("დელეგატების რეიტინგი") + " — " + t("ქართული რესპუბლიკა"),
    description: t("ავტომატურად ლაგდება წევრების რაოდენობის მიხედვით."),
    ...languageAlternates("/leaderboard", await getLocale()),
  };
}

// Reused byte-exact from the shipped Card `header` heading (git history) -- spliced by
// scripts/task12-inject, never hand-retyped. Moved into SectionRule's `label` because Card's
// `header` slot is a bare small-caps label now (Task 4), not a title+action row -- see the
// task-12 brief's Card-header-carry note.
const SECTION_HEADING = "ცოცხალი რეიტინგი";

export default async function LeaderboardPage() {
  const t = await getCopy();
  const [delegates, regions] = await Promise.all([fetchPublicDelegates(), fetchRegions()]);
  const ranked = rankDelegates(delegates);
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-2">
        <Eyebrow>{t("ლიდერბორდი")}</Eyebrow>
      </div>
      <h1 className="font-serif text-4xl font-bold text-ink">{t("დელეგატების რეიტინგი")}</h1>
      <p className="mt-3 text-muted-fg">{t("ავტომატურად ლაგდება წევრების რაოდენობის მიხედვით.")}</p>
      <div className="mt-8">
        <SectionRule
          label={t(SECTION_HEADING)}
          action={
            <Badge>
              {formatCountKa(ranked.length)} {t("დელეგატი")}
            </Badge>
          }
        />
        <LeaderboardDirectory delegates={ranked} regions={regions} />
      </div>
      <p className="mt-4 text-center text-xs text-muted-fg/80">
        {t("რეიტინგი ახლდება ავტომატურად ყოველი ახალი წევრის დამატებისას.")}
      </p>
    </main>
  );
}
