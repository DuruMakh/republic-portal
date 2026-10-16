import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CabinetHead,
  CabinetPage,
  CabinetPanel,
  CabinetPanelTitle,
  CabinetStat,
} from "@/components/CabinetPage";
import { Pill } from "@/components/Pill";
import { ReferralCard } from "@/components/ReferralCard";
import { UnityButtonLink } from "@/components/UnityButtonLink";
import type { DelegatePanelData } from "@/lib/cabinet";
import type { TeamRsvpEvent } from "@/lib/community";
import { showEvents } from "@/lib/events-switch";
import { showRatings } from "@/lib/ratings-switch";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { rankDelegates } from "@/lib/ranking";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";
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

  // Events hidden (the default, ADR-042): no team-RSVP card, so no read for it either.
  const eventsShown = showEvents();
  const { data: teamRsvpsRaw, error: teamRsvpsError } = eventsShown
    ? await supabase.rpc("delegate_team_rsvps")
    : { data: null, error: null };
  // A failure here must stay scoped to the team-RSVP card — render a degraded
  // card in its slot below instead of throwing, so it can never take down the
  // whole delegate panel (unlike delegate_panel's failure above, which must).
  const teamRsvps = (teamRsvpsRaw ?? []) as unknown as TeamRsvpEvent[];

  // Rank reuses the leaderboard's exact inputs + math (spec §3.6) so the two
  // surfaces can never disagree. Ratings hidden (the default, ADR-052): no rank card, so no
  // reads for it either.
  const ratingsShown = showRatings();
  let rankValue: string = "—";
  let rankSub: string | undefined;
  if (ratingsShown) {
    const [{ data: publicDelegates, error: rankError }, authResult] = await Promise.all([
      supabase.from("public_delegates").select("id, first_name, last_name, members"),
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
  }

  return (
    <CabinetPage deco="map">
      <CabinetHead
        title={`გამარჯობა, ${state.firstName}`}
        aside={<Pill status={panel.status} />}
        asideInline
        lede="მართე შენი გუნდი და თვალი ადევნე მხარდაჭერას რეალურ დროში."
      />

      <div className="mt-8 grid items-start gap-8 md:mt-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
        <div className="flex min-w-0 flex-col gap-6">
          {/* No dues, so no "active" tier (ADR-037): totalCount — every member in the
              team, the same figure the ranking counts — is the headline. „გუნდის წევრი“
              keeps it apart from the referral card's წევრი row, which counts the link's
              sign-ups instead (ADR-039); the card's supporter row replaced the old
              delegate-link-only supporter box. */}
          <div className="grid gap-6 sm:grid-cols-2 sm:gap-10">
            <CabinetStat
              value={panel.totalCount}
              label="გუნდის წევრი"
              sub="ლიმიტის გარეშე"
              accent
            />
            {ratingsShown ? (
              <CabinetStat value={rankValue} label="რეიტინგში ადგილი" sub={rankSub} />
            ) : null}
          </div>
          <CabinetPanel>
            <CabinetPanelTitle>გუნდის დეტალური სია</CabinetPanelTitle>
            <p className="mt-2 mb-0 text-[16px] leading-[1.6] text-prose">
              იხილე ყველა წევრი, მათი სტატუსი და რეგისტრაციის თარიღი.
            </p>
            <UnityButtonLink href="/delegate/team" variant="teal" size="sm" arrow className="mt-6">
              ნახე შენი გუნდი
            </UnityButtonLink>
          </CabinetPanel>
          {!eventsShown ? null : teamRsvpsError ? (
            <CabinetPanel>
              <CabinetPanelTitle>გუნდის RSVP</CabinetPanelTitle>
              <p className="mt-3 mb-0 text-[15px] text-secondary">{GENERIC_FUNNEL_ERROR}</p>
            </CabinetPanel>
          ) : (
            <TeamRsvpCard events={teamRsvps} />
          )}
        </div>
        {panel.referralCode != null ? (
          <ReferralCard
            tone="wine"
            code={panel.referralCode}
            supporters={panel.referralSupporters ?? 0}
            members={panel.referralMembers ?? 0}
          />
        ) : null}
      </div>
    </CabinetPage>
  );
}
