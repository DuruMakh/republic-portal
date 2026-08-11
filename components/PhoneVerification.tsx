"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { OtpInput } from "@/components/OtpInput";
import { otpSchema } from "@/lib/funnel-schemas";
import {
  PHONE_VERIFICATION_MESSAGES,
  PHONE_VERIFICATION_RESEND_SECONDS,
} from "@/lib/phone-verification/contracts";
import {
  sendPhoneVerificationAction,
  verifyPhoneVerificationAction,
} from "@/app/(public)/join/phone-actions";

interface PhoneVerificationProps {
  phone: string;
  challengeId: string;
  expiresAt: string;
  onChallengeChanged(challenge: { challengeId: string; expiresAt: string }): void;
  onVerified(phone: string): void | Promise<void>;
}

export function PhoneVerification({
  phone,
  challengeId,
  expiresAt,
  onChallengeChanged,
  onVerified,
}: PhoneVerificationProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(PHONE_VERIFICATION_RESEND_SECONDS);
  const inFlightRef = useRef(false);
  const verifiedRef = useRef(false);
  const cooldownActive = cooldown > 0;

  useEffect(() => {
    if (!cooldownActive) return;
    const timer = setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldownActive]);

  async function verify() {
    if (inFlightRef.current || verifiedRef.current) return;
    setError(undefined);
    const parsed = otpSchema.safeParse({ code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "შეიყვანე 6-ნიშნა კოდი");
      return;
    }

    inFlightRef.current = true;
    setBusy(true);
    try {
      const result = await verifyPhoneVerificationAction({
        challengeId,
        code: parsed.data.code,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      verifiedRef.current = true;
      try {
        await onVerified(result.phone);
      } catch {
        // The parent normally owns registration recovery. If it unexpectedly rejects,
        // release the one-shot guard too so the visibly enabled button remains usable.
        verifiedRef.current = false;
      }
    } catch {
      setError(PHONE_VERIFICATION_MESSAGES.service_unavailable);
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  async function resend() {
    if (cooldown > 0 || inFlightRef.current) return;
    setError(undefined);
    inFlightRef.current = true;
    setBusy(true);
    try {
      const result = await sendPhoneVerificationAction({ phone });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      verifiedRef.current = false;
      setCode("");
      onChallengeChanged({ challengeId: result.challengeId, expiresAt: result.expiresAt });
      setCooldown(PHONE_VERIFICATION_RESEND_SECONDS);
    } catch {
      setError(PHONE_VERIFICATION_MESSAGES.service_unavailable);
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-expires-at={expiresAt}>
      <p className="text-sm text-muted-fg">
        გამოგზავნილია SMS კოდი ნომერზე <strong className="text-ink">{phone}</strong>. შეიყვანე
        6-ნიშნა კოდი.
      </p>
      <OtpInput value={code} onChange={setCode} error={error} />
      <Button onClick={verify} disabled={busy}>
        დადასტურება
      </Button>
      <button
        type="button"
        className="text-sm text-muted-fg underline-offset-2 enabled:hover:underline disabled:opacity-60"
        disabled={cooldownActive || busy}
        onClick={resend}
      >
        {cooldown > 0 ? `ხელახლა გაგზავნა (${cooldown}წმ)` : "ხელახლა გაგზავნა"}
      </button>
    </div>
  );
}
