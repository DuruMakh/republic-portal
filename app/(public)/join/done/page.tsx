"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { TransferInstructions } from "@/components/TransferInstructions";
import { deriveDestination } from "@/lib/cabinet";
import { clearFreshCompletion, peekFreshCompletion } from "../fresh-completion";
import { useFunnelGuard } from "../useFunnelGuard";

export default function DonePage() {
  const router = useRouter();
  const { state, ready } = useFunnelGuard("done");
  const [fresh] = useState(() => peekFreshCompletion()); // idempotent — StrictMode-safe

  useEffect(() => {
    clearFreshCompletion(); // consume once mounted; later visits forward below
  }, []);

  useEffect(() => {
    if (ready && state && !fresh) router.replace(deriveDestination(state));
  }, [ready, state, fresh, router]);

  if (!ready || !state || !fresh) return null;

  return (
    <main className="mx-auto max-w-xl px-6 pb-16 pt-10">
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
          <ButtonLink href="/" variant="ghost">
            მთავარი გვერდი
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
