"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { PendingExplainer } from "@/components/PendingExplainer";
import { Pill } from "@/components/Pill";
import { TransferInstructions } from "@/components/TransferInstructions";
import { deriveDestination } from "@/lib/cabinet";
import { clearFreshCompletion, peekFreshCompletion } from "../fresh-completion";
import { useFunnelGuard } from "../useFunnelGuard";

export default function PendingPage() {
  const router = useRouter();
  const { state, ready } = useFunnelGuard("pending");
  const [fresh] = useState(() => peekFreshCompletion()); // idempotent — StrictMode-safe

  useEffect(() => {
    // consume only once this screen renders (see done/page.tsx) — clearing on bare
    // mount could skip the confirmation screen on a transient guard failure.
    if (ready && state && fresh) clearFreshCompletion();
  }, [ready, state, fresh]);

  useEffect(() => {
    if (ready && state && !fresh) router.replace(deriveDestination(state));
  }, [ready, state, fresh, router]);

  if (!ready || !state || !fresh) return null;

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
        <div className="mt-6 flex flex-col gap-2">
          <ButtonLink href="/delegate">გადადი პანელზე</ButtonLink>
          <ButtonLink href="/" variant="ghost">
            მთავარი გვერდი
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
