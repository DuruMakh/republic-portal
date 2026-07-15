"use client";

import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { TransferInstructions } from "../TransferInstructions";
import { useFunnelGuard } from "../useFunnelGuard";

export default function DonePage() {
  const { state, ready } = useFunnelGuard("done");
  if (!ready || !state) return null;

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
          <ButtonLink href="/">მთავარი გვერდი</ButtonLink>
          <ButtonLink href="/leaderboard" variant="ghost">
            დელეგატების რეიტინგი
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
