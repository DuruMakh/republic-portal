import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
import { initialsKa } from "@/lib/cabinet";
import { formatCountKa } from "@/lib/format";
import type { FunnelState } from "@/lib/funnel";
import { createServerSupabase } from "@/lib/supabase/server";
import { DelegateChange } from "./DelegateChange";

export const metadata: Metadata = { title: "ჩემი დელეგატი — ქართული რესპუბლიკა" };

export default async function MyDelegatePage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("funnel_state");
  const state = data as unknown as FunnelState; // layout guarantees exists+completed
  if (state.role === "delegate") redirect("/delegate"); // members-only page (spec §3.1)

  const [{ data: delegates }, { data: regions }] = await Promise.all([
    supabase
      .from("public_delegates")
      .select("id, first_name, last_name, region_id, region_name_ka, active_supporters"),
    supabase.from("regions").select("id, name_ka").order("id"),
  ]);
  const current = state.chosenDelegate
    ? ((delegates ?? []).find((d) => d.id === state.chosenDelegate?.id) ?? null)
    : null;

  return (
    <main>
      <div className="mb-8">
        <Eyebrow>პირადი კაბინეტი</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-ink">ჩემი დელეგატი</h1>
        <p className="mt-2 text-sm text-muted-fg">
          დელეგატი შენს ხმას წარადგენს მოძრაობაში. არჩევანი ყოველთვის შენზეა.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/5 p-4">
        <span className="text-xl" aria-hidden>
          🔄
        </span>
        <div>
          <p className="text-sm font-bold text-ink">
            შენ შეგიძლია ნებისმიერ დროს, შეზღუდვის გარეშე შეცვალო დელეგატი.
          </p>
          <p className="mt-1 text-sm text-muted-fg">
            არჩევანი ძალაში შედის მყისიერად და აისახება დელეგატის რეიტინგზე.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card title="მიმდინარე დელეგატი">
          {state.chosenDelegate ? (
            <div>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 font-bold text-brand"
                  aria-hidden
                >
                  {initialsKa(state.chosenDelegate.firstName, state.chosenDelegate.lastName)}
                </div>
                <div>
                  <h3 className="font-bold text-ink" data-testid="current-delegate">
                    {state.chosenDelegate.firstName} {state.chosenDelegate.lastName}
                  </h3>
                  <div className="mt-1 flex items-center gap-2">
                    <Pill status="approved" />
                    {current?.region_name_ka ? (
                      <span className="text-sm text-muted-fg">{current.region_name_ka}</span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                <span className="text-muted-fg">აქტიური მხარდამჭერი</span>
                <strong className="text-lg text-ink">
                  {formatCountKa(current?.active_supporters ?? 0)}
                </strong>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 font-bold text-brand"
                aria-hidden
              >
                ცმ
              </div>
              <div>
                <h3 className="font-bold text-ink" data-testid="current-delegate">
                  ცენტრალური მოძრაობა
                </h3>
                <p className="mt-1 text-sm text-muted-fg">
                  შენ პირდაპირ ცენტრალურ მოძრაობას უჭერ მხარს.
                </p>
              </div>
            </div>
          )}
        </Card>

        <Card title="დელეგატის შეცვლა">
          <DelegateChange
            regions={regions ?? []}
            delegates={delegates ?? []}
            currentDelegateId={state.chosenDelegate?.id ?? null}
            initialRegionId={state.regionId ?? regions?.[0]?.id ?? 1}
          />
        </Card>
      </div>
    </main>
  );
}
