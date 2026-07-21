import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
import { initialsKa, memberSinceKa } from "@/lib/cabinet";
import { createServerSupabase, getCabinetState } from "@/lib/supabase/server";
import { ProfileForm } from "./ProfileForm";
import { RegisteredProfileForm } from "./RegisteredProfileForm";

export const metadata: Metadata = { title: "ჩემი პროფილი — ქართული რესპუბლიკა" };

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
        <div className="mb-8">
          <Eyebrow>პირადი კაბინეტი</Eyebrow>
          <h1 className="mt-1 text-2xl font-bold text-ink">ჩემი პროფილი</h1>
          <p className="mt-2 text-sm text-muted-fg">მართე შენი პერსონალური მონაცემები.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
          <Card>
            <div className="text-center">
              <div
                className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-xl font-bold text-brand"
                aria-hidden
              >
                {initialsKa(state.firstName, state.lastName)}
              </div>
              <h2 className="text-lg font-bold text-ink">
                {state.firstName} {state.lastName}
              </h2>
            </div>
            <dl className="mt-5 flex flex-col gap-2.5 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-fg">რეგიონი</dt>
                <dd className="font-semibold text-ink" data-testid="summary-region">
                  {regionName}
                </dd>
              </div>
            </dl>
          </Card>
          <div className="flex flex-col gap-6">
            <RegisteredProfileForm
              initial={{ firstName: state.firstName, lastName: state.lastName }}
              phone={user?.phone ?? null}
              personalIdMasked={state.personalIdMasked}
            />
            <Card>
              <p className="text-xs font-bold uppercase tracking-widest text-brand">
                შემდეგი ნაბიჯი
              </p>
              <h3 className="mt-1 text-lg font-bold text-ink">გახდი წევრი</h3>
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

  return (
    <main>
      <div className="mb-8">
        <Eyebrow>პირადი კაბინეტი</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-ink">ჩემი პროფილი</h1>
        <p className="mt-2 text-sm text-muted-fg">
          მართე შენი პერსონალური მონაცემები და წევრობის სტატუსი.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
        <Card>
          <div className="text-center">
            <div
              className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-xl font-bold text-brand"
              aria-hidden
            >
              {initialsKa(state.firstName, state.lastName)}
            </div>
            <h2 className="text-lg font-bold text-ink">
              {state.firstName} {state.lastName}
            </h2>
            <div className="mt-2">
              <Pill
                status={state.status === "active_member" ? "active_member" : "profile_completed"}
                label={state.status === "active_member" ? "აქტიური" : "წევრი"}
              />
            </div>
          </div>
          <dl className="mt-5 flex flex-col gap-2.5 border-t border-line pt-4 text-sm">
            {since ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-fg">წევრი</dt>
                <dd className="font-semibold text-ink">{since}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-fg">რეგიონი</dt>
              <dd className="font-semibold text-ink" data-testid="summary-region">
                {regionName}
              </dd>
            </div>
            {state.role === "member" ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-fg">დელეგატი</dt>
                <dd className="font-semibold text-ink" data-testid="summary-delegate">
                  {state.chosenDelegate
                    ? `${state.chosenDelegate.firstName} ${state.chosenDelegate.lastName}`
                    : "ცენტრალური მოძრაობა"}
                </dd>
              </div>
            ) : null}
          </dl>
          {state.role === "member" ? (
            <Link
              href="/me/delegate"
              className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
            >
              დელეგატის შეცვლა →
            </Link>
          ) : null}
        </Card>
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
    </main>
  );
}
