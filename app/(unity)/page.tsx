import { HomeHero } from "@/components/HomeHero";
import { HomeJoinSteps } from "@/components/HomeJoinSteps";
import { HomeMission } from "@/components/HomeMission";
import { HomeNews } from "@/components/HomeNews";
import { HomePrinciples } from "@/components/HomePrinciples";
import { HomeRoots } from "@/components/HomeRoots";
import { HomeStructure } from "@/components/HomeStructure";
import { UnityClosing } from "@/components/UnityClosing";
import { UnityOrnament } from "@/components/UnityOrnament";
import { fetchPublicNews, fetchPublicStats } from "@/lib/supabase/public";

export const revalidate = 60;

/** How many of the latest stories the homepage shows. */
const NEWS_COUNT = 3;

/**
 * The homepage in the owner's „ერთობა“ redesign (design files Main-cc44, Home-Mobile-sstd).
 * The header above it turns wine on "/", so the hero reads as one block with it. The design has
 * no ranking, events or finance section: the homepage fetches only the counters and the news,
 * and the hidden surfaces stay off it whatever their switches say (ADR-034, ADR-042, ADR-052).
 * The teal braid closes the page right above the footer, as in the design.
 */
export default async function HomePage() {
  const [stats, news] = await Promise.all([fetchPublicStats(), fetchPublicNews()]);

  return (
    <main>
      <HomeHero />
      <HomeMission stats={stats} />
      <HomeJoinSteps />
      <HomePrinciples />
      <HomeStructure />
      <HomeNews items={news.slice(0, NEWS_COUNT)} />
      <HomeRoots />
      <UnityClosing />
      <UnityOrnament tone="teal" />
    </main>
  );
}
