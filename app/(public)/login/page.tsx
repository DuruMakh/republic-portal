"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Card } from "@/components/Card";
import { createClient } from "@/lib/supabase/client";
import { normalizeGeorgianPhone } from "@/lib/validation";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [phase, setPhase] = useState<"phone" | "otp">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string>();
  const [devOtp, setDevOtp] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function requestOtp() {
    setError(undefined);
    const normalized = normalizeGeorgianPhone(phoneInput);
    if (!normalized) {
      setError("შეიყვანეთ ქართული მობილურის ნომერი (5XX XX XX XX)");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({ phone: normalized });
    setBusy(false);
    if (err) {
      setError("კოდის გაგზავნა ვერ მოხერხდა, სცადეთ თავიდან");
      return;
    }
    setPhone(normalized);
    setPhase("otp");
    if (
      process.env.NEXT_PUBLIC_APP_ENV === "development" ||
      process.env.NEXT_PUBLIC_APP_ENV === "preview"
    ) {
      const res = await fetch(`/api/dev/otp?phone=${encodeURIComponent(normalized)}`);
      if (res.ok) setDevOtp((await res.json()).otp);
    }
  }

  async function verify() {
    setError(undefined);
    setBusy(true);
    const { error: err } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    setBusy(false);
    if (err) {
      setError("კოდი არასწორია");
      return;
    }
    router.push("/me/profile");
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
          <div className="flex flex-col gap-4">
            <Field
              label="SMS კოდი"
              name="otp"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              error={error}
            />
            {devOtp ? (
              <p className="rounded-lg bg-surface p-3 text-sm text-muted-fg" data-testid="dev-otp">
                სატესტო კოდი: <strong>{devOtp}</strong>
              </p>
            ) : null}
            <Button onClick={verify} disabled={busy}>
              დადასტურება
            </Button>
          </div>
        )}
      </Card>
    </main>
  );
}
