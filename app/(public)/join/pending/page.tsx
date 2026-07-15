"use client";

import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { PendingExplainer } from "@/components/PendingExplainer";
import { Pill } from "@/components/Pill";
import { TransferInstructions } from "@/components/TransferInstructions";
import { useFunnelGuard } from "../useFunnelGuard";

export default function PendingPage() {
  const { state, ready } = useFunnelGuard("pending");
  if (!ready || !state) return null;

  return (
    <main className="mx-auto max-w-xl px-6 pb-16 pt-10">
      <Card>
        <div className="text-center">
          <p className="text-5xl" aria-hidden>
            ⏳
          </p>
          <h2 className="mt-3 text-2xl font-bold text-ink">შენი დელეგატის პროფილი განიხილება</h2>
          <div className="mt-2">
            <Pill status="pending" />
          </div>
          <p className="mx-auto mt-3 max-w-prose text-sm text-muted-fg">
            რეგისტრაცია დასრულებულია — ახლა შენი მონაცემები გადამოწმების პროცესშია. სუპერ-ადმინი
            ადასტურებს დელეგატის იურიდიულ ვერიფიკაციას.
          </p>
        </div>
        <PendingExplainer />
        <TransferInstructions tier={state.tier} referenceCode={state.referenceCode} />
        <div className="mt-6">
          <ButtonLink href="/" className="w-full">
            მთავარი გვერდი
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
