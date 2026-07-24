import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ballotButtonClasses } from "@/components/Ballot";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { IndexRow } from "@/components/IndexRow";
import { Pill } from "@/components/Pill";
import { SectionRule } from "@/components/SectionRule";
import {
  cabinetRole,
  DELEGACY_REJECTED_NOTE,
  DELEGACY_STATUS_LABELS,
  deriveDelegacyPhase,
  formatPhoneKa,
  memberSinceKa,
  TEAM_STATUS_LABELS,
  type TeamMemberStatus,
} from "@/lib/cabinet";
import { formatCountKa } from "@/lib/format";
import { rankDelegates } from "@/lib/ranking";
import { fetchPublicDelegates } from "@/lib/supabase/public";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";
import { ProfileForm } from "./ProfileForm";
import { RegisteredProfileForm } from "./RegisteredProfileForm";

export const metadata: Metadata = { title: "ჩემი პროფილი — ქართული რესპუბლიკა" };

// Reused byte-exact from components/LeaderRow.tsx (itself spliced from
// app/(public)/page.tsx's SUPPORTER_LABEL, Task 11) — the my-delegate rail
// card shows the same rank/region/supporters shape as the public registry.
const SUPPORTER_LABEL = "მხარდამჭერი";
// Spliced (never hand-retyped) from prototype/kronika-d3/kronika-d3-template.html's
// member-cabinet poll teaser (S4); verified against the Georgian (Mkhedruli,
// U+10A0-U+10FF) Unicode block before commit — see the georgian-quote-
// transcription-hazard note. New usage (spec §5.1, Appendix B: pollLabel).
const POLL_TEASER_EYEBROW = "დღის კითხვა";

export default async function ProfilePage() {
  const supabase = await createServerSupabase();
  // cabinet_state is request-cached (already fetched by the layout); the user and
  // region lookups are independent, so fan them out in parallel.
  const [state, { data: userData }, { data: regions, error: regionsError }] = await Promise.all([
    getCabinetState(), // (member) layout guarantees exists only; standing decides the branch below
    supabase.auth.getUser(),
    supabase.from("regions").select("id, name_ka").order("id"),
  ]);
  if (!state.exists) redirect("/join"); // soft-nav defense: narrow before reading profile fields
  const user = userData.user;
  if (regionsError) {
    // a failed regions load must not render an empty region picker
    throw new Error(`regions query failed: ${regionsError.message}`);
  }
  const regionName = (regions ?? []).find((r) => r.id === state.regionId)?.name_ka ?? "—";

  // Registered variant (spec §4.2): name-edit only, no member facts (tier,
  // reference code, member-since, Pill) — those don't exist yet for this
  // standing. A compact upgrade card points at the become-a-member journey.
  if (!state.completed) {
    return (
      <main>
        <h1 className="font-serif text-[2rem] font-bold text-ink">
          {state.firstName} {state.lastName}
        </h1>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-start">
          <div>
            <SectionRule label="პირადი მონაცემები" />
            <div>
              <div className="flex justify-between border-b border-hairline py-2.5">
                <span className="text-[0.85rem] text-muted-fg">ტელეფონი</span>
                <span className="font-serif text-[0.92rem] font-bold text-ink">
                  {formatPhoneKa(user?.phone)}
                </span>
              </div>
              <div className="flex justify-between border-b border-hairline py-2.5">
                <span className="text-[0.85rem] text-muted-fg">პირადი ნომერი</span>
                <span className="font-serif text-[0.92rem] font-bold tracking-wide text-ink">
                  {state.personalIdMasked}
                </span>
              </div>
              <div className="flex justify-between border-b border-hairline py-2.5">
                <span className="text-[0.85rem] text-muted-fg">რეგიონი</span>
                <span
                  className="font-serif text-[0.92rem] font-bold text-ink"
                  data-testid="summary-region"
                >
                  {regionName}
                </span>
              </div>
            </div>
            <div className="mt-8">
              <RegisteredProfileForm
                initial={{ firstName: state.firstName, lastName: state.lastName }}
                phone={user?.phone ?? null}
                personalIdMasked={state.personalIdMasked}
              />
            </div>
          </div>
          <div>
            <Card variant="callout">
              <Eyebrow>შემდეგი ნაბიჯი</Eyebrow>
              <h3 className="mt-1 font-serif text-lg font-bold text-ink">გახდი წევრი</h3>
              <p className="mt-1 text-sm text-muted-fg">
                წევრობა ხსნის ხმის მიცემას გამოკითხვებში, დელეგატის არჩევას და წევრებისთვის
                განკუთვნილ სიახლეებს.
              </p>
              <div className="mt-4">
                <ButtonLink href="/me/membership">გახდი წევრი →</ButtonLink>
              </div>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  const since = memberSinceKa(state.registrationCompletedAt ?? state.createdAt);
  const delegacyPhase = deriveDelegacyPhase(state);
  // Pill only distinguishes the two "completed" substatuses; state.completed being true
  // guarantees status isn't "registered" here, but MemberStatus is wider than
  // TeamMemberStatus, so narrow explicitly before indexing TEAM_STATUS_LABELS (strict mode).
  const teamStatus: TeamMemberStatus =
    state.status === "active_member" ? "active_member" : "profile_completed";
  // An APPROVED delegate wins cabinetRole() (R2 §3.1); this page has no explicit
  // redirect for that case (unchanged), so it keeps its pre-existing behavior of
  // simply not rendering the member-only delegate rail — same gate the old
  // summary-card delegate row used.
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

  return (
    <main>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-3">
        <h1 className="font-serif text-[2rem] font-bold text-ink">
          {state.firstName} {state.lastName}
        </h1>
        <p className="flex flex-wrap items-center gap-2 text-[0.78rem] text-muted-fg">
          <Pill status={teamStatus} label={TEAM_STATUS_LABELS[teamStatus]} />
          {state.referenceCode ? <span>· {state.referenceCode}</span> : null}
          {since ? <span>· წევრი {since}</span> : null}
        </p>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div>
          <SectionRule label="პირადი მონაცემები" />
          <div>
            <div className="flex justify-between border-b border-hairline py-2.5">
              <span className="text-[0.85rem] text-muted-fg">ტელეფონი</span>
              <span className="font-serif text-[0.92rem] font-bold text-ink">
                {formatPhoneKa(user?.phone)}
              </span>
            </div>
            <div className="flex justify-between border-b border-hairline py-2.5">
              <span className="text-[0.85rem] text-muted-fg">პირადი ნომერი</span>
              <span className="font-serif text-[0.92rem] font-bold tracking-wide text-ink">
                {state.personalIdMasked}
              </span>
            </div>
            <div className="flex justify-between border-b border-hairline py-2.5">
              <span className="text-[0.85rem] text-muted-fg">რეგიონი</span>
              <span
                className="font-serif text-[0.92rem] font-bold text-ink"
                data-testid="summary-region"
              >
                {regionName}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-b border-hairline py-2.5">
              <span className="text-[0.85rem] text-muted-fg">სამუშაო ადგილი / სტატუსი</span>
              <span className="font-serif text-[0.92rem] font-bold text-ink text-right">
                {state.employment}
              </span>
            </div>
          </div>

          <div className="mt-8">
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
            />
          </div>

          {delegacyPhase === "eligible" ? (
            <Card variant="callout">
              <Eyebrow>შემდეგი საფეხური</Eyebrow>
              <h3 className="mt-1 font-serif text-lg font-bold text-ink">გახდი დელეგატი</h3>
              <p className="mt-1 text-sm text-muted-fg">
                წარადგინე კანდიდატურა და გახდი მოძრაობის რეგიონული ხმა — საჯარო პროფილით და საკუთარი
                გუნდით.
              </p>
              <div className="mt-4">
                <ButtonLink href="/me/delegacy">გაიგე მეტი →</ButtonLink>
              </div>
            </Card>
          ) : delegacyPhase === "pending" ? (
            <Card variant="callout">
              <div className="flex items-center gap-3">
                <Pill status="pending" label={DELEGACY_STATUS_LABELS.pending} />
                <h3 className="font-serif text-lg font-bold text-ink">
                  დელეგატობის მოთხოვნა გაგზავნილია
                </h3>
              </div>
              <p className="mt-2 text-sm text-muted-fg">შედეგს აქვე ნახავ.</p>
            </Card>
          ) : delegacyPhase === "rejected" ? (
            <Card variant="callout">
              <div className="flex items-center gap-3">
                <Pill status="rejected" label={DELEGACY_STATUS_LABELS.rejected} />
                <h3 className="font-serif text-lg font-bold text-ink">დელეგატობის მოთხოვნა</h3>
              </div>
              <p className="mt-2 text-sm text-muted-fg">{DELEGACY_REJECTED_NOTE}</p>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          {isMemberRole ? (
            <Card variant="callout">
              <div className="text-[0.7rem] font-bold uppercase tracking-[.18em] text-muted-fg">
                ჩემი დელეგატი
              </div>
              {myDelegateRanked ? (
                <div className="mt-2">
                  <IndexRow
                    rank={myDelegateRanked.rank}
                    name={`${myDelegateRanked.first_name} ${myDelegateRanked.last_name}`}
                    meta={myDelegateRanked.region_name_ka ?? "—"}
                    figure={formatCountKa(myDelegateRanked.active_supporters)}
                    figureLabel={SUPPORTER_LABEL}
                    href={`/delegates/${myDelegateRanked.slug}`}
                  />
                </div>
              ) : (
                <div className="mt-2">
                  <p
                    className="font-serif text-lg font-bold text-ink"
                    data-testid="current-delegate"
                  >
                    {state.chosenDelegate
                      ? `${state.chosenDelegate.firstName} ${state.chosenDelegate.lastName}`
                      : "ცენტრალური მოძრაობა"}
                  </p>
                  {state.chosenDelegate ? (
                    <p
                      className="mt-1 text-[0.78rem] text-muted-fg"
                      data-testid="delegate-unavailable"
                    >
                      დელეგატი ამჟამად მიუწვდომელია
                    </p>
                  ) : (
                    <p className="mt-1 text-[0.78rem] text-muted-fg">
                      შენ პირდაპირ ცენტრალურ მოძრაობას უჭერ მხარს.
                    </p>
                  )}
                </div>
              )}
              <Link
                href="/me/delegate"
                className="mt-3 inline-block text-sm font-semibold text-brand hover:underline"
              >
                დელეგატის შეცვლა →
              </Link>
            </Card>
          ) : null}

          {teaserPoll ? (
            <Card variant="callout">
              <Eyebrow>{POLL_TEASER_EYEBROW}</Eyebrow>
              <p className="mt-2 font-serif text-[1.02rem] font-semibold leading-snug text-ink">
                {teaserPoll.question}
              </p>
              <Link
                href="/me/polls"
                className={`mt-3 inline-flex items-center justify-center ${ballotButtonClasses("solid")}`}
              >
                სრულად →
              </Link>
            </Card>
          ) : null}
        </div>
      </div>
    </main>
  );
}
