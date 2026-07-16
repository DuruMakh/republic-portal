"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Stepper } from "@/components/Stepper";
import { TierPicker } from "@/components/TierPicker";
import { deriveFunnelStep, funnelRoute, type Tier } from "@/lib/funnel";
import { funnelCompleteAction } from "../actions";
import { markFreshCompletion } from "../fresh-completion";
import { useFunnelGuard } from "../useFunnelGuard";

export default function Step3Page() {
  const router = useRouter();
  const { state, ready } = useFunnelGuard("step-3");
  const [tier, setTier] = useState<Tier>(10);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function complete() {
    setError(undefined);
    setBusy(true);
    const result = await funnelCompleteAction({ tier });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    markFreshCompletion();
    router.replace(funnelRoute(deriveFunnelStep(result.state)));
  }

  if (!ready || !state) return null;

  return (
    <main className="mx-auto max-w-xl px-6 pb-16 pt-8">
      <div className="mb-6 flex justify-center">
        <Stepper current={3} />
      </div>
      <Card>
        <p className="text-xs font-bold uppercase tracking-widest text-brand">
          {state.role === "delegate" ? "დელეგატის რეგისტრაცია" : "წევრის რეგისტრაცია"}
        </p>
        <h2 className="mt-1 text-xl font-bold text-ink">საწევრო შენატანი</h2>
        <p className="mb-5 mt-1 text-sm text-muted-fg">
          აირჩიე ყოველთვიური საწევრო. შენატანი ამყარებს მოძრაობის დამოუკიდებლობას.
        </p>
        <TierPicker value={tier} onChange={setTier} />
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-5 flex flex-col gap-3">
          <Button onClick={complete} disabled={busy} size="lg">
            რეგისტრაციის დასრულება
          </Button>
          <p className="text-center text-xs text-muted-fg">
            გადახდა ხდება საბანკო გადარიცხვით — ბარათის მონაცემები არ გჭირდება.
          </p>
        </div>
      </Card>
    </main>
  );
}
