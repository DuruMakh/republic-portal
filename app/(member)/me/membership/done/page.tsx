import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
import { TransferInstructions } from "@/components/TransferInstructions";
import { getCabinetState } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "რეგისტრაცია დასრულებულია — ქართული რესპუბლიკა" };

export default async function MembershipDonePage() {
  const state = await getCabinetState(); // (member) layout guarantees exists only
  if (state.role === "delegate") redirect("/delegate"); // members-only journey (spec §3.1)
  if (!state.completed) redirect("/me/membership"); // nothing to show until the wizard finishes

  return (
    <main className="mx-auto max-w-xl">
      <div className="mb-6">
        <Eyebrow>წევრობის გაფორმება</Eyebrow>
      </div>
      <Card>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-ink">რეგისტრაცია დასრულებულია ✓</h2>
          <div className="mt-2">
            <Pill status="profile_completed" />
          </div>
        </div>
        <TransferInstructions tier={state.tier} referenceCode={state.referenceCode} />
        <p className="mt-4 text-sm text-muted-fg">
          დელეგატი:{" "}
          <strong className="text-ink" data-testid="chosen-delegate">
            {state.chosenDelegate
              ? `${state.chosenDelegate.firstName} ${state.chosenDelegate.lastName}`
              : "ცენტრალური მოძრაობა"}
          </strong>
        </p>
        <p className="mt-2 text-sm text-muted-fg">
          აქტიური წევრის სტატუსი გააქტიურდება პირველი შენატანის დადასტურების შემდეგ.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <ButtonLink href="/me/profile">ჩემი კაბინეტი</ButtonLink>
        </div>
      </Card>
    </main>
  );
}
