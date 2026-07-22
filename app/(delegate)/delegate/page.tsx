import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
import { StatCard } from "@/components/StatCard";
import type { DelegatePanelData } from "@/lib/cabinet";
import type { TeamRsvpEvent } from "@/lib/community";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { rankDelegates } from "@/lib/ranking";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";
import { ReferralCard } from "./ReferralCard";
import { TeamRsvpCard } from "./TeamRsvpCard";

export const metadata: Metadata = { title: "დელეგატის პანელი — ქართული რესპუბლიკა" };

export default async function DelegateDashboardPage() {
  const supabase = await createServerSupabase();
  // cabinet_state is request-cached (the delegate layout already fetched it); pair
  // its (free) read with the delegate_panel round-trip.
  const [state, { data: panelData, error: panelError }] = await Promise.all([
    getCabinetState(), // layout guarantees delegate+completed
    supabase.rpc("delegate_panel"),
  ]);
  if (!state.exists) redirect("/join"); // soft-nav defense: narrow before reading state.firstName
  if (panelError || panelData === null) {
    throw new Error(`delegate_panel failed: ${panelError?.message ?? "empty"}`);
  }
  const panel = panelData as unknown as DelegatePanelData;
  // The (delegate) layout admits ONLY approved delegates (isApprovedDelegate) and
  // no RPC demotes an approved row — the old pending/rejected branches below were
  // unreachable dead weight and were removed with the R2 gate move.

  const { data: teamRsvpsRaw, error: teamRsvpsError } = await supabase.rpc("delegate_team_rsvps");
  // A failure here must stay scoped to the team-RSVP card — render a degraded
  // card in its slot below instead of throwing, so it can never take down the
  // whole delegate panel (unlike delegate_panel's failure above, which must).
  const teamRsvps = (teamRsvpsRaw ?? []) as unknown as TeamRsvpEvent[];

  // Rank reuses the leaderboard's exact inputs + math (spec §3.6) so the two
  // surfaces can never disagree.
  let rankValue: string = "—";
  let rankSub: string | undefined;
  const [{ data: publicDelegates, error: rankError }, authResult] = await Promise.all([
    supabase.from("public_delegates").select("id, first_name, last_name, active_supporters"),
    supabase.auth.getUser(),
  ]);
  if (rankError) {
    // an approved delegate must never see an honest-looking „—" because a query failed
    throw new Error(`public_delegates query failed: ${rankError.message}`);
  }
  if (authResult.error || !authResult.data.user) {
    // same invariant: a failed auth read must throw, not silently degrade the rank to „—"
    throw new Error(`auth.getUser failed: ${authResult.error?.message ?? "no user"}`);
  }
  const authUser = authResult.data.user;
  const ranked = rankDelegates(publicDelegates ?? []);
  const mine = ranked.find((d) => d.id === authUser.id);
  if (mine) {
    rankValue = `#${mine.rank}`;
    rankSub = `${mine.rank} / ${ranked.length} დელეგატი`;
  }

  return (
    <main>
      <div className="mb-8">
        <Eyebrow>დელეგატის კაბინეტი</Eyebrow>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-ink">გამარჯობა, {state.firstName}</h1>
          <Pill status={panel.status} />
        </div>
        <p className="mt-2 text-sm text-muted-fg">
          მართე შენი გუნდი და თვალი ადევნე მხარდაჭერას რეალურ დროში.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {panel.referralCode ? <ReferralCard code={panel.referralCode} /> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            value={panel.activeCount}
            label="აქტიური მხარდამჭერი"
            sub="ლიმიტის გარეშე"
            accent="brand"
          />
          <StatCard value={panel.totalCount} label="სულ გუნდში" />
          <StatCard value={panel.registeredCount} label="რეგისტრირებული" />
          <StatCard value={rankValue} label="რეიტინგში ადგილი" sub={rankSub} />
        </div>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-ink">გუნდის დეტალური სია</h3>
              <p className="mt-1 text-sm text-muted-fg">
                იხილე ყველა წევრი, მათი სტატუსი და რეგისტრაციის თარიღი.
              </p>
            </div>
            <ButtonLink href="/delegate/team" variant="dark">
              ნახე შენი გუნდი
            </ButtonLink>
          </div>
        </Card>
        {teamRsvpsError ? (
          <Card title="გუნდის RSVP">
            <p className="text-sm text-muted-fg">{GENERIC_FUNNEL_ERROR}</p>
          </Card>
        ) : (
          <TeamRsvpCard events={teamRsvps} />
        )}
      </div>
    </main>
  );
}
