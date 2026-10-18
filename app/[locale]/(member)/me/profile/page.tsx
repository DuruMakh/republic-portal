import { OriginalLanguageNote } from "@/components/OriginalLanguageNote";

import { localePath } from "@/lib/i18n/routing";

import { getCopy, getLocale } from "@/lib/i18n/server";
import type { Metadata } from "next";
import Link from "@/lib/i18n/navigation";
import { redirect } from "next/navigation";
import {
  CabinetDataRow,
  CabinetHead,
  CabinetPage,
  CabinetPanel,
  CabinetPanelTitle,
  CabinetSectionLabel,
} from "@/components/CabinetPage";
import { Caps } from "@/components/Caps";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";
import { IndexRow } from "@/components/IndexRow";
import { Pill } from "@/components/Pill";
import { ReferralCard } from "@/components/ReferralCard";
import { UnityButtonLink } from "@/components/UnityButtonLink";
import { UnityKicker } from "@/components/UnityKicker";
import {
  cabinetRole,
  DELEGACY_REJECTED_NOTE,
  DELEGACY_STATUS_LABELS,
  deriveDelegacyPhase,
  formatPhoneKa,
  isApprovedDelegate,
  TEAM_STATUS_LABELS,
  type TeamMemberStatus,
} from "@/lib/cabinet";
import { EMPLOYMENT_PRESETS } from "@/lib/funnel-schemas";
import { formatMemberSince } from "@/lib/i18n/format";
import { formatCountKa } from "@/lib/format";
import { showMembershipDues } from "@/lib/membership-dues";
import { rankDelegates } from "@/lib/ranking";
import { showRatings } from "@/lib/ratings-switch";
import { fetchPublicDelegates } from "@/lib/supabase/public";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";
import { deleteMyAccountAction } from "./delete-account-actions";
import { ProfileForm } from "./ProfileForm";
import { RegisteredProfileForm } from "./RegisteredProfileForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  return { title: t("ჩემი პროფილი — ქართული რესპუბლიკა") };
}

// Same label as components/LeaderRow.tsx's RANK_FIGURE_LABEL (ADR-035) — the my-delegate rail
// card shows the same rank/region/supporters shape as the public registry.
const RANK_FIGURE_LABEL = "წევრი";
// Spliced (never hand-retyped) from prototype/kronika-d3/kronika-d3-template.html's
// member-cabinet poll teaser (S4); verified against the Georgian (Mkhedruli,
// U+10A0-U+10FF) Unicode block before commit — see the georgian-quote-
// transcription-hazard note. New usage (spec §5.1, Appendix B: pollLabel).
const POLL_TEASER_EYEBROW = "დღის კითხვა";

export default async function ProfilePage() {
  const locale = await getLocale();
  const t = await getCopy();
  const supabase = await createServerSupabase();
  // cabinet_state is request-cached (already fetched by the layout); the user and region
  // lookups are independent, so fan them out in parallel.
  const [state, { data: userData }, { data: regions, error: regionsError }] = await Promise.all([
    getCabinetState(), // (member) layout guarantees exists only; standing decides the branch below
    supabase.auth.getUser(),
    supabase.from("regions").select("id, name_ka").order("id"),
  ]);
  if (!state.exists) redirect(localePath("/join", locale)); // soft-nav defense: narrow before reading profile fields
  const user = userData.user;
  if (regionsError) {
    // a failed regions load must not render an empty region picker
    throw new Error(`regions query failed: ${regionsError.message}`);
  }
  const regionName = (regions ?? []).find((r) => r.id === state.regionId)?.name_ka ?? "—";

  // The danger section closes both branches below (registered and member alike). Staff (any
  // admin_roles row: cabinet_state's admin flag) cannot self-delete and see only the
  // explanation (spec 2026-10-08 §3.3); an approved delegate also learns their public page goes
  // and their team moves.
  const deleteSection = (
    <div className="mt-12 md:mt-[72px]">
      <DeleteAccountSection
        isStaff={state.admin}
        isDelegate={isApprovedDelegate(state)}
        action={deleteMyAccountAction}
      />
    </div>
  );

  // Registered variant (spec §4.2): name-edit only, no member facts (tier,
  // reference code, member-since, Pill) — those don't exist yet for this
  // standing. A compact upgrade card points at the become-a-member journey.
  if (!state.completed) {
    return (
      <CabinetPage>
        <CabinetHead
          kicker={t("ჩემი პროფილი")}
          face="serif"
          title={`${state.firstName} ${state.lastName}`}
        />
        <div className="mt-8 grid items-start gap-8 md:mt-12 min-[1100px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[1100px]:gap-14">
          <div className="flex min-w-0 flex-col gap-6">
            <CabinetSectionLabel>{t("პირადი მონაცემები")}</CabinetSectionLabel>
            <div className="-mt-6">
              <CabinetDataRow label={t("ტელეფონი")}>{formatPhoneKa(user?.phone)}</CabinetDataRow>
              {state.hasPersonalId ? (
                <CabinetDataRow label={t("პირადი ნომერი")}>
                  <span className="tracking-wide">{state.personalIdMasked}</span>
                </CabinetDataRow>
              ) : null}
              <CabinetDataRow label={t("რეგიონი")}>
                <span data-testid="summary-region">{t(regionName)}</span>
              </CabinetDataRow>
            </div>
            <div className="mt-4">
              <RegisteredProfileForm
                initial={{ firstName: state.firstName, lastName: state.lastName }}
                phone={user?.phone ?? null}
                personalIdMasked={state.personalIdMasked}
                hasPersonalId={state.hasPersonalId}
              />
            </div>
          </div>
          <div className="min-[1100px]:sticky min-[1100px]:top-6">
            <CabinetPanel tone="wine">
              <UnityKicker tone="light">{t("შემდეგი ნაბიჯი")}</UnityKicker>
              <h3 className="mt-4 mb-0 font-display text-[44px] font-bold leading-[.94] text-limestone md:text-[52px]">
                {t("გახდი წევრი")}
              </h3>
              <p className="mt-3.5 mb-0 text-[16.5px] leading-[1.6] text-sand">
                {t(
                  "წევრობა ხსნის ხმის მიცემას გამოკითხვებში, დელეგატის არჩევას და წევრებისთვის განკუთვნილ სიახლეებს.",
                )}
              </p>
              <div className="mt-[26px]">
                <UnityButtonLink href="/me/membership" variant="cream" arrow className="w-full">
                  {t("გახდი წევრი")}
                </UnityButtonLink>
              </div>
            </CabinetPanel>
          </div>
        </div>
        {deleteSection}
      </CabinetPage>
    );
  }

  const since = formatMemberSince(state.registrationCompletedAt ?? state.createdAt, locale);
  const delegacyPhase = deriveDelegacyPhase(state);
  // Pill only distinguishes the two "completed" substatuses; state.completed being true
  // guarantees status isn't "registered" here, but MemberStatus is wider than
  // TeamMemberStatus, so narrow explicitly before indexing TEAM_STATUS_LABELS (strict mode).
  const teamStatus: TeamMemberStatus =
    state.status === "active_member" ? "active_member" : "profile_completed";
  // An APPROVED delegate wins cabinetRole() (R2 §3.1); this page has no explicit
  // redirect for that case (unchanged), so both consumers below must account for
  // it directly: the member-only delegate rail stays gated on this flag (same gate
  // the old summary-card delegate row used), and the ReferralCard's teamNote
  // (fix-list round 2 review, Fix 2) is the negation of it — a delegate landing
  // here directly has a link that DOES bind a team, same as /delegate's default.
  const isMemberRole = cabinetRole(state) === "member";

  // DECLARED reads (Global Constraints, spec §5.1): the my-delegate card needs
  // rank/region/supporters, which cabinet_state alone doesn't carry (only the
  // delegate's name) -- fetchPublicDelegates()+rankDelegates deliver it, the
  // same pipeline the homepage/leaderboard already use. The poll teaser is a
  // one-row existence check against the same view /me/polls itself reads.
  const [publicDelegates, pollsResult] = await Promise.all([
    fetchPublicDelegates(),
    supabase.from("member_polls").select("question,status").eq("status", "open").limit(1),
  ]);
  const myDelegateRanked =
    isMemberRole && state.chosenDelegate
      ? (rankDelegates(publicDelegates).find((d) => d.id === state.chosenDelegate?.id) ?? null)
      : null;
  // Decorative-only, like the delegate dashboard's team-RSVP card: a transient
  // failure here just hides the teaser rather than taking down the whole
  // profile page over a poll-of-the-day blurb.
  const teaserPoll = pollsResult.data?.[0] ?? null;
  const ratingsShown = showRatings();

  return (
    <CabinetPage>
      <CabinetHead
        kicker={t("ჩემი პროფილი")}
        face="serif"
        title={`${state.firstName} ${state.lastName}`}
        aside={
          <p className="m-0 flex flex-wrap items-center gap-2 text-[15px] text-secondary md:self-end">
            <Pill status={teamStatus} label={t(TEAM_STATUS_LABELS[teamStatus])} />
            {/* the GR- code is the bank-transfer reference: only with the dues (ADR-037) */}
            {showMembershipDues() && state.referenceCode ? (
              <span>· {state.referenceCode}</span>
            ) : null}
            {since ? (
              <span>
                {t("· წევრი ")}
                {since}
              </span>
            ) : null}
          </p>
        }
      />

      <div className="mt-8 grid items-start gap-8 md:mt-12 min-[1100px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[1100px]:gap-14">
        <div className="flex min-w-0 flex-col gap-6">
          <CabinetSectionLabel>{t("პირადი მონაცემები")}</CabinetSectionLabel>
          <div className="-mt-6">
            <CabinetDataRow label={t("ტელეფონი")}>{formatPhoneKa(user?.phone)}</CabinetDataRow>
            <CabinetDataRow label={t("პირადი ნომერი")}>
              <span className="tracking-wide">{state.personalIdMasked}</span>
            </CabinetDataRow>
            <CabinetDataRow label={t("რეგიონი")}>
              <span data-testid="summary-region">{t(regionName)}</span>
            </CabinetDataRow>
            <CabinetDataRow label={t("სამუშაო ადგილი / სტატუსი")}>
              {state.employment &&
              (EMPLOYMENT_PRESETS as readonly string[]).includes(state.employment)
                ? t(state.employment)
                : state.employment}
            </CabinetDataRow>
          </div>

          <div className="mt-4">
            <ProfileForm
              initial={{
                firstName: state.firstName,
                lastName: state.lastName,
                regionId: state.regionId,
                cityId: state.cityId,
                employment: state.employment,
              }}
              phone={user?.phone ?? null}
              regions={regions ?? []}
              hasPersonalId={state.hasPersonalId}
            />
          </div>

          {delegacyPhase === "eligible" ? (
            <CabinetPanel tone="ink" className="md:px-9 md:py-8">
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative backdrop */}
              <img
                src="/unity/knot-cream.svg"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-[90px] -right-[70px] hidden h-auto w-[260px] max-w-none sm:block"
              />
              <div className="relative">
                <UnityKicker>{t("შემდეგი საფეხური")}</UnityKicker>
                <h3 className="mt-3.5 mb-0 font-serif text-[24px] font-semibold leading-[1.3] md:text-[28px]">
                  {t("გახდი დელეგატი")}
                </h3>
                <p className="mt-2.5 mb-0 max-w-[32em] text-[16px] leading-[1.6] text-prose">
                  {t(
                    "წარადგინე კანდიდატურა და გახდი მოძრაობის რეგიონული ხმა — საჯარო პროფილით და საკუთარი გუნდით.",
                  )}
                </p>
                <div className="mt-6">
                  <UnityButtonLink href="/me/delegacy" size="sm" arrow>
                    {t("გაიგე მეტი")}
                  </UnityButtonLink>
                </div>
              </div>
            </CabinetPanel>
          ) : delegacyPhase === "pending" ? (
            <CabinetPanel tone="ink" className="md:px-9 md:py-8">
              <div className="flex flex-wrap items-center gap-3">
                <Pill status="pending" label={t(DELEGACY_STATUS_LABELS.pending)} />
                <CabinetPanelTitle>{t("დელეგატობის მოთხოვნა გაგზავნილია")}</CabinetPanelTitle>
              </div>
              <p className="mt-2.5 mb-0 text-[16px] text-secondary">{t("შედეგს აქვე ნახავ.")}</p>
            </CabinetPanel>
          ) : delegacyPhase === "rejected" ? (
            <CabinetPanel tone="ink" className="md:px-9 md:py-8">
              <div className="flex flex-wrap items-center gap-3">
                <Pill status="rejected" label={t(DELEGACY_STATUS_LABELS.rejected)} />
                <CabinetPanelTitle>{t("დელეგატობის მოთხოვნა")}</CabinetPanelTitle>
              </div>
              <p className="mt-2.5 mb-0 text-[16px] text-secondary">{t(DELEGACY_REJECTED_NOTE)}</p>
            </CabinetPanel>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          {isMemberRole ? (
            <CabinetPanel tone="teal" className="md:p-6">
              <div className="border-b border-rule pb-3 text-[12px] font-bold tracking-[.14em] text-teal">
                <Caps>{t("ჩემი დელეგატი")}</Caps>
              </div>
              {myDelegateRanked ? (
                <div>
                  {/* name and region only while ratings are hidden (ADR-052) */}
                  <IndexRow
                    rank={ratingsShown ? myDelegateRanked.rank : undefined}
                    name={`${myDelegateRanked.first_name} ${myDelegateRanked.last_name}`}
                    meta={t(myDelegateRanked.region_name_ka ?? "—")}
                    figure={ratingsShown ? formatCountKa(myDelegateRanked.members) : undefined}
                    figureLabel={ratingsShown ? t(RANK_FIGURE_LABEL) : undefined}
                    href={`/delegates/${myDelegateRanked.slug}`}
                  />
                </div>
              ) : (
                <div className="border-b border-rule py-3.5">
                  <p
                    className="m-0 font-serif text-[18px] font-bold text-ink"
                    data-testid="current-delegate"
                  >
                    {state.chosenDelegate
                      ? `${state.chosenDelegate.firstName} ${state.chosenDelegate.lastName}`
                      : t("არ მყავს დელეგატი")}
                  </p>
                  {state.chosenDelegate ? (
                    <p
                      className="mt-1 mb-0 text-[14px] text-secondary"
                      data-testid="delegate-unavailable"
                    >
                      {t("დელეგატი ამჟამად მიუწვდომელია")}
                    </p>
                  ) : null}
                </div>
              )}
              <Link
                href="/me/delegate"
                className="mt-4 inline-block text-[15px] font-bold text-brand underline decoration-1 underline-offset-[5px] hover:text-brand-dark"
              >
                {t("დელეგატის შეცვლა →")}
              </Link>
            </CabinetPanel>
          ) : null}

          {state.referralCode != null ? (
            <ReferralCard
              code={state.referralCode}
              supporters={state.referralSupporters ?? 0}
              members={state.referralMembers ?? 0}
              // true only for the approved-delegate case reaching this page directly
              // (see isMemberRole above): their referralCode IS the delegate code,
              // which binds a team same as /delegate's default; false (member) is
              // unchanged from before this fix.
              teamNote={!isMemberRole}
            />
          ) : null}

          {teaserPoll ? (
            <CabinetPanel tone="ink" className="md:p-6">
              <UnityKicker>{t(POLL_TEASER_EYEBROW)}</UnityKicker>
              <p
                lang="ka"
                className="mt-3.5 mb-0 font-serif text-[19px] font-semibold leading-snug text-ink"
              >
                {teaserPoll.question}
              </p>
              <OriginalLanguageNote className="mt-2 mb-0 text-[14px] text-secondary" />
              <div className="mt-4">
                <UnityButtonLink
                  href="/me/polls"
                  variant="ghost"
                  size="sm"
                  arrow
                  className="w-full"
                >
                  {t("სრულად")}
                </UnityButtonLink>
              </div>
            </CabinetPanel>
          ) : null}
        </div>
      </div>
      {deleteSection}
    </CabinetPage>
  );
}
