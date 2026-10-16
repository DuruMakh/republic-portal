import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CabinetPage } from "@/components/CabinetPage";
import { Pill } from "@/components/Pill";
import { UnityButtonLink } from "@/components/UnityButtonLink";
import { UnityKicker } from "@/components/UnityKicker";
import { isApprovedDelegate } from "@/lib/cabinet";
import { getCabinetState } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "განაცხადი გაგზავნილია — ქართული რესპუბლიკა" };

export default async function MembershipDonePage() {
  const state = await getCabinetState(); // (member) layout guarantees exists only
  if (!state.exists) redirect("/join"); // soft-nav defense: narrow before reading profile fields
  // approved-only: pending/rejected requesters keep their member surfaces (R2 §3.1)
  if (isApprovedDelegate(state)) redirect("/delegate");
  if (!state.completed) redirect("/me/membership"); // nothing to show until the wizard finishes
  // ADR-036: only a not-yet-active member is "under the board's review". A paying
  // (active_member) member who lands here by URL keeps the plain completed heading.
  const underReview = state.status !== "active_member";

  return (
    <CabinetPage>
      <div className="relative py-6 md:py-12">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative backdrop */}
        <img
          src="/unity/knot-cream.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-auto w-[360px] max-w-none -translate-x-1/2 -translate-y-1/2 md:w-[640px]"
        />
        <div className="relative mx-auto max-w-[780px] text-center">
          <div className="flex justify-center">
            <UnityKicker>წევრობის გაფორმება</UnityKicker>
          </div>
          <div className="mt-7 border-y-2 border-ink bg-limestone/86 px-6 py-10 md:py-11">
            <h1 className="m-0 font-serif text-[32px] font-semibold leading-[1.2] md:text-[48px]">
              {underReview ? "განაცხადი გაგზავნილია ✓" : "რეგისტრაცია დასრულებულია ✓"}
            </h1>
            <div className="mt-4">
              {/* the stored status stays profile_completed; only the wording says "pending" */}
              <Pill status={underReview ? "pending" : "active_member"} />
            </div>
            {underReview ? (
              <p className="mt-4 mb-0 text-[17px] text-secondary">
                შენს განაცხადს განიხილავს ბორდი.
              </p>
            ) : null}
            <p className="mt-4 mb-0 text-[17px] text-ink">
              დელეგატი:{" "}
              <strong className="font-serif" data-testid="chosen-delegate">
                {state.chosenDelegate
                  ? `${state.chosenDelegate.firstName} ${state.chosenDelegate.lastName}`
                  : "არ მყავს დელეგატი"}
              </strong>
            </p>
            <div className="mt-7">
              <UnityButtonLink href="/me/profile" className="max-md:w-full">
                ჩემი კაბინეტი
              </UnityButtonLink>
            </div>
          </div>
        </div>
      </div>
    </CabinetPage>
  );
}
