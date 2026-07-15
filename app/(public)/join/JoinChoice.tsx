"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card, cardSkin } from "@/components/Card";
import {
  deriveFunnelStep,
  funnelRoute,
  isReferralCodeCandidate,
  type FunnelState,
} from "@/lib/funnel";
import { createClient } from "@/lib/supabase/client";

// Delegate card reuses Card's own skin (not a wrapper div around <Card>) to avoid a
// double border when the red ring is layered on — see components/Card.tsx.
// Exactly ONE shadow utility: `shadow-sm` + `shadow-[...]` both set --tw-shadow and
// stylesheet order (not class order) decides, so the ring would be lost. The arbitrary
// value layers the ring plus shadow-sm's own v4 value in a single declaration.
const delegateCardSkin = cardSkin
  .replace("border-line", "border-brand")
  .replace(
    "shadow-sm",
    "shadow-[0_0_0_3px_rgba(200,16,46,0.08),0_1px_3px_0_rgb(0_0_0/0.1),0_1px_2px_-1px_rgb(0_0_0/0.1)]",
  );

export function JoinChoice() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const role = params.get("role");
    const ref = params.get("ref");
    // ?role=delegate and ?ref=<code> skip the choice screen (spec §3.1)
    if (role === "delegate") {
      router.replace("/join/step-1?role=delegate");
      return;
    }
    if (ref && isReferralCodeCandidate(ref)) {
      router.replace(`/join/step-1?ref=${encodeURIComponent(ref)}`);
      return;
    }
    // signed-in visitor with funnel state → forward to their current screen
    let cancelled = false;
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return;
      const { data, error } = await supabase.rpc("funnel_state");
      if (error || cancelled || data === null) return;
      const state = data as FunnelState;
      if (state.exists) router.replace(funnelRoute(deriveFunnelStep(state)));
    });
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16 pt-10">
      <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-brand">
        რეგისტრაცია
      </p>
      <h1 className="text-center font-serif text-3xl font-bold text-ink">
        როგორ გსურს შემოგვიერთდე?
      </h1>
      <p className="mx-auto mb-9 mt-3 max-w-prose text-center text-muted-fg">
        ორივე გზა იწყება ერთი და იმავე სწრაფი რეგისტრაციით. დელეგატობა მოითხოვს დამატებით
        ადმინისტრაციულ დადასტურებას.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex h-full flex-col items-center gap-3 text-center">
            <span className="text-4xl" aria-hidden>
              🙋
            </span>
            <h3 className="text-lg font-bold text-ink">წევრი / მხარდამჭერი</h3>
            <p className="flex-1 text-sm text-muted-fg">
              შეავსე პროფილი, აირჩიე დელეგატი და ჩართე ყოველთვიური საწევრო. მიიღე წვდომა პირად
              კაბინეტზე.
            </p>
            <ButtonLink href="/join/step-1?role=member" className="w-full">
              გახდი წევრი
            </ButtonLink>
          </div>
        </Card>
        <section className={`${delegateCardSkin} p-6`}>
          <div className="flex h-full flex-col items-center gap-3 text-center">
            <span className="text-4xl" aria-hidden>
              ⭐
            </span>
            <h3 className="text-lg font-bold text-ink">დელეგატი</h3>
            <p className="flex-1 text-sm text-muted-fg">
              ააგე საკუთარი გუნდი, მიიღე პერსონალური რეფერალური ლინკი და მართვის პანელი.
              საჯაროდ ჩნდები დადასტურების შემდეგ.
            </p>
            <ButtonLink href="/join/step-1?role=delegate" variant="dark" className="w-full">
              გახდი დელეგატი
            </ButtonLink>
          </div>
        </section>
      </div>
    </main>
  );
}
