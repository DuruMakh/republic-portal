import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Eyebrow } from "@/components/Eyebrow";
import type { TeamMember } from "@/lib/cabinet";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";
import { TeamTable } from "./TeamTable";

export const metadata: Metadata = { title: "ჩემი გუნდი — ქართული რესპუბლიკა" };

export default async function DelegateTeamPage() {
  const supabase = await createServerSupabase();
  // delegateStatus comes free from the request-cached cabinet_state (the layout
  // already fetched it) — no need for delegate_panel's three count subqueries here.
  const state = await getCabinetState();
  if (!state.exists) redirect("/join"); // soft-nav defense: narrow before reading delegateStatus
  if (state.delegateStatus !== "approved") redirect("/delegate"); // no team pre-approval (spec §3.7)
  const { data: teamData, error: teamError } = await supabase.rpc("delegate_team");
  if (teamError || teamData === null) {
    throw new Error(`delegate_team failed: ${teamError?.message ?? "empty"}`);
  }
  const team = teamData as unknown as TeamMember[];

  return (
    <main>
      <div className="mb-8">
        <Eyebrow>დელეგატის კაბინეტი</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-ink">ჩემი გუნდი</h1>
        <p className="mt-2 text-sm text-muted-fg">
          შენს გუნდში{" "}
          <strong className="text-ink" data-testid="team-count">
            {team.length}
          </strong>{" "}
          წევრი
        </p>
      </div>
      <TeamTable members={team} />
    </main>
  );
}
