import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { isApprovedDelegate } from "@/lib/cabinet";
import { formatCountKa } from "@/lib/format";
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

  const [{ data: delegates, error: delegatesError }, { data: regions, error: regionsError }] =
    await Promise.all([
      supabase
        .from("public_delegates")
        .select("id, first_name, last_name, region_id, region_name_ka, active_supporters"),
      supabase.from("regions").select("id, name_ka").order("id"),
    ]);
  if (delegatesError) {
    // a transient failure must not show „0 აქტიური მხარდამჭერი" for a real delegate
    throw new Error(`public_delegates query failed: ${delegatesError.message}`);
  }
  if (regionsError) {
    throw new Error(`regions query failed: ${regionsError.message}`);
  }
  const current = state.chosenDelegate
    ? ((delegates ?? []).find((d) => d.id === state.chosenDelegate?.id) ?? null)
    : null;

  return (
    <main>
      <div className="mb-8 border-b-2 border-ink pb-4">
        <h1 className="font-serif text-[2rem] font-bold text-ink">ჩემი დელეგატი</h1>
        <p className="mt-2 text-sm text-muted-fg">
          დელეგატი შენს ხმას წარადგენს მოძრაობაში. არჩევანი ყოველთვის შენზეა.
        </p>
      </div>

      <div className="mb-6">
        <p className="text-sm font-bold text-ink">
          შენ შეგიძლია ნებისმიერ დროს, შეზღუდვის გარეშე შეცვალო დელეგატი.
        </p>
        <p className="mt-1 text-sm text-muted-fg">
          არჩევანი ძალაში შედის მყისიერად და აისახება დელეგატის რეიტინგზე.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card title="მიმდინარე დელეგატი">
          {state.chosenDelegate ? (
            <div>
              <h3 className="font-serif text-lg font-bold text-ink" data-testid="current-delegate">
                {state.chosenDelegate.firstName} {state.chosenDelegate.lastName}
              </h3>
              <div className="mt-1.5 flex items-center gap-2">
                {current ? (
                  <>
                    <Pill status="approved" />
                    {current.region_name_ka ? (
                      <span className="text-sm text-muted-fg">{current.region_name_ka}</span>
                    ) : null}
                  </>
                ) : (
                  // bound delegate is no longer approved/public — don't fake an „approved“ pill
                  <span className="text-sm text-muted-fg" data-testid="delegate-unavailable">
                    დელეგატი ამჟამად მიუწვდომელია
                  </span>
                )}
              </div>
              {current ? (
                <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3 text-sm">
                  <span className="text-muted-fg">აქტიური მხარდამჭერი</span>
                  <strong className="font-serif text-lg text-ink">
                    {formatCountKa(current.active_supporters)}
                  </strong>
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <h3 className="font-serif text-lg font-bold text-ink" data-testid="current-delegate">
                ცენტრალური მოძრაობა
              </h3>
              <p className="mt-1 text-sm text-muted-fg">
                შენ პირდაპირ ცენტრალურ მოძრაობას უჭერ მხარს.
              </p>
            </div>
          )}
        </Card>

        <Card title="დელეგატის შეცვლა">
          <DelegateChange
            regions={regions ?? []}
            delegates={delegates ?? []}
            currentDelegateId={state.chosenDelegate?.id ?? null}
            initialRegionId={current?.region_id ?? state.regionId ?? regions?.[0]?.id ?? 1}
          />
        </Card>
      </div>
    </main>
  );
}
