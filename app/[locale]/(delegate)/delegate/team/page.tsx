import { localePath } from "@/lib/i18n/routing";

import { getCopy, getLocale } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CabinetHead, CabinetPage } from "@/components/CabinetPage";
import type { TeamMember } from "@/lib/cabinet";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";
import { TeamTable } from "./TeamTable";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  return { title: t("ჩემი გუნდი — ქართული რესპუბლიკა") };
}

export default async function DelegateTeamPage() {
  const locale = await getLocale();
  const t = await getCopy();
  const supabase = await createServerSupabase();
  // delegateStatus comes free from the request-cached cabinet_state (the layout
  // already fetched it) — no need for delegate_panel's three count subqueries here.
  const state = await getCabinetState();
  if (!state.exists) redirect(localePath("/join", locale)); // soft-nav defense: narrow before reading delegateStatus
  if (state.delegateStatus !== "approved") redirect(localePath("/delegate", locale)); // no team pre-approval (spec §3.7)
  const { data: teamData, error: teamError } = await supabase.rpc("delegate_team");
  if (teamError || teamData === null) {
    throw new Error(`delegate_team failed: ${teamError?.message ?? "empty"}`);
  }
  const team = teamData as unknown as TeamMember[];

  return (
    <CabinetPage>
      <CabinetHead
        title={t("ჩემი გუნდი")}
        lede={
          <>
            {t("შენს გუნდში")}{" "}
            <strong className="text-ink" data-testid="team-count">
              {team.length}
            </strong>{" "}
            {locale === "en"
              ? t(team.length === 1 ? "წევრი" : "წევრები").toLowerCase()
              : t("წევრი")}
          </>
        }
      />
      <div className="mt-8 md:mt-12">
        <TeamTable members={team} />
      </div>
    </CabinetPage>
  );
}
