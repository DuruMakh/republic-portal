"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { OtpInput } from "@/components/OtpInput";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { otpSchema } from "@/lib/funnel-schemas";
import { createClient } from "@/lib/supabase/client";

const RESEND_COOLDOWN_S = 60;

export function OtpVerification({
  phone,
  onVerified,
}: {
  phone: string;
  onVerified: () => void | Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [devOtp, setDevOtp] = useState<string>();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const fetchDevOtp = useCallback(async () => {
    if (
      process.env.NEXT_PUBLIC_APP_ENV !== "development" &&
      process.env.NEXT_PUBLIC_APP_ENV !== "preview"
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/dev/otp?phone=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const data = (await res.json()) as { otp?: string };
        if (data.otp && mountedRef.current) setDevOtp(data.otp);
      }
    } catch {
      // dev helper only — ignore
    }
  }, [phone]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dev-code fetch is intentionally fire-and-forget on mount
    void fetchDevOtp();
  }, [fetchDevOtp]);

  async function verify() {
    setError(undefined);
    const parsed = otpSchema.safeParse({ code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({
      phone,
      token: parsed.data.code,
      type: "sms",
    });
    if (err) {
      setBusy(false);
      setError("კოდი არასწორია");
      return;
    }
    await onVerified();
    setBusy(false);
  }

  async function resend() {
    if (cooldown > 0 || busy) return;
    setError(undefined);
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (err) {
      setError("კოდი უკვე გაიგზავნა — სცადე ერთ წუთში");
      return;
    }
    setCooldown(RESEND_COOLDOWN_S);
    void fetchDevOtp();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-fg">
        გამოგზავნილია SMS კოდი ნომერზე <strong className="text-ink">{phone}</strong>. შეიყვანე
        6-ნიშნა კოდი.
      </p>
      <OtpInput value={code} onChange={setCode} error={error} />
      {devOtp ? (
        <p className="rounded-lg bg-surface p-3 text-sm text-muted-fg" data-testid="dev-otp">
          სატესტო კოდი: <strong>{devOtp}</strong>
        </p>
      ) : null}
      <Button onClick={verify} disabled={busy}>
        დადასტურება
      </Button>
      <button
        type="button"
        className="text-sm text-muted-fg underline-offset-2 enabled:hover:underline disabled:opacity-60"
        disabled={cooldown > 0}
        onClick={resend}
      >
        {cooldown > 0 ? `ხელახლა გაგზავნა (${cooldown}წმ)` : "ხელახლა გაგზავნა"}
      </button>
    </div>
  );
}
