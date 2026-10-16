import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CabinetHead,
  CabinetPage,
  CabinetPanel,
  CabinetPanelTitle,
} from "@/components/CabinetPage";
import { Pill } from "@/components/Pill";
import { DELEGATE_LEFT_NOTE } from "@/lib/account-deletion-copy";
import { isApprovedDelegate } from "@/lib/cabinet";
import { formatCountKa } from "@/lib/format";
import { showRatings } from "@/lib/ratings-switch";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";
import { DelegateChange } from "./DelegateChange";

export const metadata: Metadata = { title: "ჩემი დელეგატი — ქართული რესპუბლიკა" };

export default async function MyDelegatePage() {
  const supabase = await createServerSupabase();
  const state = await getCabinetState(); // layout guarantees exists only
  if (!state.exists) redirect("/join"); // soft-nav defense: narrow before reading profile fields
  if (!state.completed) redirect("/me"); // members only (spec §4.2)
  // approved-only: pending/rejected requesters keep their member surfaces (R2 §3.1)
  if (isApprovedDelegate(state)) redirect("/delegate");

  const [
    { data: delegates, error: delegatesError },
    { data: regions, error: regionsError },
    { data: openMembership },
  ] = await Promise.all([
    supabase
      .from("public_delegates")
      .select("id, first_name, last_name, region_id, region_name_ka, members"),
    supabase.from("regions").select("id, name_ka").order("id"),
    // The caller's own open membership (RLS "own memberships readable"; at most one row is
    // open). Advisory only, like the profile page's poll teaser: a failed read just hides the
    // note rather than taking the page down.
    supabase.from("memberships").select("note").is("ended_at", null).maybeSingle(),
  ]);
  if (delegatesError) {
    // a transient failure must not show „0 წევრი" for a real delegate
    throw new Error(`public_delegates query failed: ${delegatesError.message}`);
  }
  if (regionsError) {
    throw new Error(`regions query failed: ${regionsError.message}`);
  }
  const current = state.chosenDelegate
    ? ((delegates ?? []).find((d) => d.id === state.chosenDelegate?.id) ?? null)
    : null;
  // Set when the member's delegate deleted their account and the team moved to central
  // (spec 2026-10-08 §3.2). Choosing a delegate opens a fresh row without the note, so it
  // goes away by itself; re-picking central opens no new row, so it stays (accepted).
  const delegateLeft = openMembership?.note === "delegate_left";
  // Hidden by default (ADR-052): the chosen delegate's member count and the word რეიტინგი.
  const ratingsShown = showRatings();

  return (
    <CabinetPage deco="map">
      <CabinetHead
        title="ჩემი დელეგატი"
        lede="დელეგატი შენს ხმას წარადგენს მოძრაობაში. არჩევანი ყოველთვის შენზეა."
      />

      {delegateLeft ? (
        <div className="mt-6 md:mt-8">
          <CabinetPanel tone="ink" className="md:p-6">
            <p role="status" className="m-0 text-[16px] font-semibold text-ink">
              {DELEGATE_LEFT_NOTE}
            </p>
          </CabinetPanel>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-1.5 md:mt-8">
        <p className="m-0 text-[16px] font-bold leading-[1.55] md:text-[17px]">
          შენ შეგიძლია ნებისმიერ დროს, შეზღუდვის გარეშე შეცვალო დელეგატი.
        </p>
        <p className="m-0 text-[15px] leading-[1.55] text-secondary md:text-[16px]">
          {ratingsShown
            ? "არჩევანი ძალაში შედის მყისიერად და აისახება დელეგატის რეიტინგზე."
            : "არჩევანი ძალაში შედის მყისიერად."}
        </p>
      </div>

      <div className="mt-7 grid items-start gap-6 md:mt-10 min-[1100px]:grid-cols-2 min-[1100px]:gap-10">
        <CabinetPanel tone="teal">
          <CabinetPanelTitle tone="teal">მიმდინარე დელეგატი</CabinetPanelTitle>
          <div className="mt-5 flex items-center gap-4 md:gap-[22px]">
            <span
              aria-hidden="true"
              className="inline-flex size-16 flex-none overflow-hidden rounded-full bg-sandstone md:size-20"
            >
              <svg viewBox="0 0 52 52" className="size-full">
                <circle cx="26" cy="21" r="9" fill="#D6CCBC" />
                <path d="M9 52c0-11 7.6-18 17-18s17 7 17 18z" fill="#D6CCBC" />
              </svg>
            </span>
            <div className="min-w-0">
              <h3
                className="m-0 font-serif text-[24px] font-bold leading-[1.2] md:text-[30px]"
                data-testid="current-delegate"
              >
                {state.chosenDelegate
                  ? `${state.chosenDelegate.firstName} ${state.chosenDelegate.lastName}`
                  : "არ მყავს დელეგატი"}
              </h3>
              {state.chosenDelegate ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                  {current ? (
                    <>
                      <Pill status="approved" />
                      {current.region_name_ka ? (
                        <span className="text-[15px] text-secondary">{current.region_name_ka}</span>
                      ) : null}
                    </>
                  ) : (
                    // bound delegate is no longer approved/public — don't fake an „approved“ pill
                    <span className="text-[15px] text-secondary" data-testid="delegate-unavailable">
                      დელეგატი ამჟამად მიუწვდომელია
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          {current && ratingsShown ? (
            <div className="mt-6 flex items-baseline justify-between border-y border-rule py-3.5">
              <span className="text-[15px] text-secondary">წევრი</span>
              <strong className="font-serif text-[24px]">{formatCountKa(current.members)}</strong>
            </div>
          ) : null}
        </CabinetPanel>

        <CabinetPanel tone="ink">
          <CabinetPanelTitle>დელეგატის შეცვლა</CabinetPanelTitle>
          <div className="mt-7">
            <DelegateChange
              regions={regions ?? []}
              // only the fields the picker uses: its props reach the browser, and the member
              // counts must not while ratings are hidden (ADR-052)
              delegates={(delegates ?? []).map(({ id, first_name, last_name, region_id }) => ({
                id,
                first_name,
                last_name,
                region_id,
              }))}
              currentDelegateId={state.chosenDelegate?.id ?? null}
              initialRegionId={current?.region_id ?? state.regionId ?? regions?.[0]?.id ?? 1}
            />
          </div>
        </CabinetPanel>
      </div>
    </CabinetPage>
  );
}
