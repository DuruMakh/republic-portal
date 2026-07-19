import type { Metadata } from "next";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { PendingExplainer } from "@/components/PendingExplainer";
import { Pill } from "@/components/Pill";
import { StatCard } from "@/components/StatCard";
import type { DelegatePanelData } from "@/lib/cabinet";
import type { TeamRsvpEvent } from "@/lib/community";
import { rankDelegates } from "@/lib/ranking";
import { createServerSupabase, getFunnelState } from "@/lib/supabase/server";
import { ReferralCard } from "./ReferralCard";
import { TeamRsvpCard } from "./TeamRsvpCard";

export const metadata: Metadata = { title: "დელეგატის პანელი — ქართული რესპუბლიკა" };

export default async function DelegateDashboardPage() {
  const supabase = await createServerSupabase();
  // funnel_state is request-cached (the delegate layout already fetched it); pair
  // its (free) read with the delegate_panel round-trip.
  const [state, { data: panelData, error: panelError }] = await Promise.all([
    getFunnelState(), // layout guarantees delegate+completed
    supabase.rpc("delegate_panel"),
  ]);
  if (panelError || panelData === null) {
    throw new Error(`delegate_panel failed: ${panelError?.message ?? "empty"}`);
  }
  const panel = panelData as unknown as DelegatePanelData;

  const { data: teamRsvpsRaw, error: teamRsvpsError } =
    panel.status === "approved"
      ? await supabase.rpc("delegate_team_rsvps")
      : { data: null, error: null };
  if (teamRsvpsError) {
    throw new Error(`delegate_team_rsvps failed: ${teamRsvpsError.message}`);
  }
  const teamRsvps = (teamRsvpsRaw ?? []) as unknown as TeamRsvpEvent[];

  // Rank reuses the leaderboard's exact inputs + math (spec §3.6) so the two
  // surfaces can never disagree.
  let rankValue: string = "—";
  let rankSub: string | undefined;
  if (panel.status === "approved") {
    const [{ data: publicDelegates, error: rankError }, authResult] = await Promise.all([
      supabase.from("public_delegates").select("id, first_name, last_name, active_supporters"),
      supabase.auth.getUser(),
    ]);
    if (rankError) {
      // an approved delegate must never see the pending-state's honest „—" because a query failed
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

      {panel.status === "approved" ? (
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
            <StatCard value={panel.draftCount} label="მონახაზები (Draft)" />
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
          <TeamRsvpCard events={teamRsvps} />
        </div>
      ) : panel.status === "pending" ? (
        <Card>
          <h2 className="text-lg font-bold text-ink">შენი დელეგატის პროფილი განიხილება</h2>
          <PendingExplainer />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard value={0} label="აქტიური მხარდამჭერი" />
            <StatCard value={0} label="სულ გუნდში" />
            <StatCard value={0} label="მონახაზები (Draft)" />
            <StatCard value="—" label="რეიტინგში ადგილი" />
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm font-semibold text-danger" data-testid="rejected-notice">
            დელეგატის პროფილი უარყოფილია — დაგვიკავშირდი დეტალებისთვის.
          </p>
        </Card>
      )}
    </main>
  );
}
