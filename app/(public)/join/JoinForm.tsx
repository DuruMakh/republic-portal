"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ZodIssue } from "zod";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { Field } from "@/components/Field";
import { OtpVerification } from "@/components/OtpVerification";
import { deriveDestination } from "@/lib/cabinet";
import {
  DUPLICATE_PERSONAL_ID_MESSAGE,
  isReferralCodeCandidate,
  type ActionResult,
  type CabinetState,
} from "@/lib/funnel";
import { registerActionSchema, registerSchema } from "@/lib/funnel-schemas";
import { createClient } from "@/lib/supabase/client";
import { registerAction } from "./actions";

type JoinPhase = "form" | "otp" | "retry";

const FIELD_KEYS = ["firstName", "lastName", "personalId", "phone"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

function isFieldKey(key: unknown): key is FieldKey {
  return typeof key === "string" && (FIELD_KEYS as readonly string[]).includes(key);
}

export default function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const refParam = params.get("ref");
  const refCode = refParam && isReferralCodeCandidate(refParam) ? refParam : null;

  const [phase, setPhase] = useState<JoinPhase>("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [personalId, setPersonalId] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current !== null) clearTimeout(redirectTimeoutRef.current);
    };
  }, []);

  // On-mount check: a signed-in visitor who already has a cabinet is forwarded
  // straight past the registration form — never a server redirect, so the cached
  // public shell stays valid for everyone else.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return;
      const { data, error } = await supabase.rpc("cabinet_state");
      if (error || cancelled || data === null) return;
      const state = data as unknown as CabinetState;
      if (state.exists) router.replace(deriveDestination(state));
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  function applyValidationErrors(issues: ZodIssue[]) {
    const next: Partial<Record<FieldKey, string>> = {};
    let unmapped: string | undefined;
    for (const issue of issues) {
      const key = issue.path[0];
      if (isFieldKey(key)) {
        next[key] = issue.message;
      } else {
        // e.g. refCode — no field renders it, so surface via the form-level error
        unmapped ??= issue.message;
      }
    }
    setErrors(next);
    if (unmapped !== undefined) setFormError(unmapped);
  }

  function handleRegisterResult(result: ActionResult) {
    if (!result.ok) {
      if (result.error === DUPLICATE_PERSONAL_ID_MESSAGE) {
        // the phone is already OTP-proven for this session — no new code needed,
        // just let them fix the personal ID and resubmit directly
        setErrors({ personalId: result.error });
        setPhase("retry");
      } else {
        setFormError(result.error);
        setPhase("form");
      }
      return;
    }
    if (result.state.exists && result.state.created === false) {
      // phone already had an account (RPC no-opped, nothing overwritten) — only
      // revealed after proving phone ownership (spec §6). register() always
      // returns a present state, so `created` only ever rides on exists:true.
      setNotice("ეს ნომერი უკვე რეგისტრირებულია");
      redirectTimeoutRef.current = setTimeout(
        () => router.replace(deriveDestination(result.state)),
        1500,
      );
      return;
    }
    // fresh registration — the cabinet greets them, no ceremony page (spec §4.1)
    router.replace("/me");
  }

  async function submitForm() {
    setFormError(undefined);
    const parsed = registerSchema.safeParse({
      firstName,
      lastName,
      personalId: personalId.replace(/\D/g, ""),
      phone: phoneInput,
      refCode,
    });
    if (!parsed.success) {
      applyValidationErrors(parsed.error.issues);
      return;
    }
    setErrors({});
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data.phone });
    setBusy(false);
    if (error) {
      setFormError("კოდის გაგზავნა ვერ მოხერხდა, სცადეთ თავიდან");
      return;
    }
    setPhone(parsed.data.phone);
    setPhase("otp");
  }

  async function submitRetry() {
    setFormError(undefined);
    const parsed = registerActionSchema.safeParse({
      firstName,
      lastName,
      personalId: personalId.replace(/\D/g, ""),
      refCode,
    });
    if (!parsed.success) {
      applyValidationErrors(parsed.error.issues);
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await registerAction(parsed.data);
    setBusy(false);
    handleRegisterResult(result);
  }

  async function afterVerify() {
    const result = await registerAction({
      firstName,
      lastName,
      personalId: personalId.replace(/\D/g, ""),
      refCode,
    });
    handleRegisterResult(result);
  }

  return (
    <main className="mx-auto max-w-xl px-6 pb-16 pt-10">
      <Eyebrow>რეგისტრაცია</Eyebrow>
      <h1 className="mt-1 font-serif text-3xl font-bold text-ink">შემოგვიერთდი ერთ წუთში</h1>
      <p className="mt-3 text-muted-fg">მხოლოდ ძირითადი მონაცემები — დანარჩენს კაბინეტში ნახავ.</p>
      <div className="mt-8">
        <Card>
          {notice ? (
            <p
              className="mb-4 rounded-lg bg-info/10 p-3 text-sm text-info"
              data-testid="join-notice"
            >
              {notice}
            </p>
          ) : null}
          {phase === "otp" ? (
            <OtpVerification phone={phone} onVerified={afterVerify} />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="სახელი"
                  name="firstName"
                  placeholder="მაგ. ნინო"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  error={errors.firstName}
                />
                <Field
                  label="გვარი"
                  name="lastName"
                  placeholder="მაგ. ბერიძე"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  error={errors.lastName}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Field
                  label="პირადი ნომერი"
                  name="personalId"
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="01001000000"
                  value={personalId}
                  onChange={(e) => setPersonalId(e.target.value)}
                  error={errors.personalId}
                />
                <p className="text-xs text-muted-fg">11 ნიშნა</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Field
                  label="ტელეფონის ნომერი"
                  name="phone"
                  inputMode="tel"
                  placeholder="+995 5XX XX XX XX"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  error={errors.phone}
                  disabled={phase === "retry"}
                />
                <p className="text-xs text-muted-fg">
                  {phase === "retry"
                    ? "ნომერი დადასტურებულია"
                    : "ამ ნომერზე მოგივა ერთჯერადი SMS კოდი დასადასტურებლად."}
                </p>
              </div>
              {formError ? <p className="text-sm text-danger">{formError}</p> : null}
              <Button
                onClick={phase === "retry" ? submitRetry : submitForm}
                disabled={busy}
                size="lg"
              >
                {phase === "retry" ? "დარეგისტრირება" : "გაგრძელება →"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
