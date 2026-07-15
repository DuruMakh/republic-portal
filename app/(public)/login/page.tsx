"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { OtpVerification } from "@/components/OtpVerification";
import { deriveFunnelStep, funnelRoute, type FunnelState } from "@/lib/funnel";
import { createClient } from "@/lib/supabase/client";
import { normalizeGeorgianPhone } from "@/lib/validation";

export default function LoginPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"phone" | "otp">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function requestOtp() {
    setError(undefined);
    const normalized = normalizeGeorgianPhone(phoneInput);
    if (!normalized) {
      setError("შეიყვანეთ ქართული მობილურის ნომერი (5XX XX XX XX)");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({ phone: normalized });
    setBusy(false);
    if (err) {
      setError("კოდის გაგზავნა ვერ მოხერხდა, სცადეთ თავიდან");
      return;
    }
    setPhone(normalized);
    setPhase("otp");
  }

  async function routeByFunnelState() {
    // Post-verify landing (spec §3.8): no profile → /join; otherwise the derived step.
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("funnel_state");
    if (rpcError || data === null) {
      router.replace("/join");
      return;
    }
    const state = data as unknown as FunnelState;
    router.replace(state.exists ? funnelRoute(deriveFunnelStep(state)) : "/join");
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <Card title="შესვლა">
        {phase === "phone" ? (
          <div className="flex flex-col gap-4">
            <Field
              label="ტელეფონის ნომერი"
              name="phone"
              placeholder="5XX XX XX XX"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              error={error}
            />
            <Button onClick={requestOtp} disabled={busy}>
              კოდის მიღება
            </Button>
          </div>
        ) : (
          <OtpVerification phone={phone} onVerified={routeByFunnelState} />
        )}
      </Card>
    </main>
  );
}
