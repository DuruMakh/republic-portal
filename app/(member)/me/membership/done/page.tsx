import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
import { isApprovedDelegate } from "@/lib/cabinet";
import { getCabinetState } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "განაცხადი გაგზავნილია — ქართული რესპუბლიკა" };

export default async function MembershipDonePage() {
  const state = await getCabinetState(); // (member) layout guarantees exists only
  if (!state.exists) redirect("/join"); // soft-nav defense: narrow before reading profile fields
  // approved-only: pending/rejected requesters keep their member surfaces (R2 §3.1)
  if (isApprovedDelegate(state)) redirect("/delegate");
  if (!state.completed) redirect("/me/membership"); // nothing to show until the wizard finishes

  return (
    <main className="mx-auto max-w-xl">
      <div className="mb-6">
        <Eyebrow>წევრობის გაფორმება</Eyebrow>
      </div>
      <div className="mx-auto max-w-lg border-y-2 border-ink py-10 text-center">
        <h1 className="font-serif text-4xl font-bold text-ink">განაცხადი გაგზავნილია ✓</h1>
        <div className="mt-4">
          {/* ADR-036: shown as under the board's review. The stored status is still
              profile_completed; only this screen's wording changed. */}
          <Pill status="pending" />
        </div>
        <p className="mt-4 text-sm text-prose">შენს განაცხადს განიხილავს ბორდი.</p>
      </div>
      <p className="mt-4 text-sm text-muted-fg">
        დელეგატი:{" "}
        <strong className="text-ink" data-testid="chosen-delegate">
          {state.chosenDelegate
            ? `${state.chosenDelegate.firstName} ${state.chosenDelegate.lastName}`
            : "არ მყავს დელეგატი"}
        </strong>
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <ButtonLink href="/me/profile">ჩემი კაბინეტი</ButtonLink>
      </div>
    </main>
  );
}
