"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ZodIssue } from "zod";
import { AuthEntryShell } from "@/components/AuthEntryShell";
import { AuthProgress } from "@/components/AuthProgress";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { PhoneVerification } from "@/components/PhoneVerification";
import { deriveDestination } from "@/lib/cabinet";
import { GENERIC_FUNNEL_ERROR, isReferralCodeCandidate, type CabinetState } from "@/lib/funnel";
import { registerActionSchema, registerSchema } from "@/lib/funnel-schemas";
import { PHONE_VERIFICATION_MESSAGES } from "@/lib/phone-verification/contracts";
import { createClient } from "@/lib/supabase/client";
import { normalizeGeorgianPhone } from "@/lib/validation";
import {
  registerGoogleAction,
  type GoogleRegistrationActionResult,
  type GoogleRegistrationFailureCode,
} from "./google-actions";
import { sendPhoneVerificationAction } from "./phone-actions";

type GoogleJoinPhase = "loading" | "google" | "form" | "otp" | "retry";
type Challenge = { challengeId: string; expiresAt: string };

const FIELD_KEYS = ["firstName", "lastName", "phone"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

function isFieldKey(key: unknown): key is FieldKey {
  return typeof key === "string" && (FIELD_KEYS as readonly string[]).includes(key);
}

function isGoogleSessionError(code: GoogleRegistrationFailureCode): boolean {
  return code === "not_authenticated" || code === "google_required";
}

export function GoogleJoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const refParam = params.get("ref");
  const refCode = refParam && isReferralCodeCandidate(refParam) ? refParam : null;
  const nextPath = refCode ? `/join?ref=${encodeURIComponent(refCode)}` : "/join";

  const [phase, setPhase] = useState<GoogleJoinPhase>("loading");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmedPhone, setConfirmedPhone] = useState<string>();
  const [challenge, setChallenge] = useState<Challenge>();
  const [verifiedPhone, setVerifiedPhone] = useState<string>();
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

  useEffect(() => {
    let cancelled = false;

    async function loadRegistrationState() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (userError || !user) {
          setPhase("google");
          return;
        }

        const { data, error } = await supabase.rpc("cabinet_state");
        if (cancelled) return;
        if (error || data === null) {
          setFormError(GENERIC_FUNNEL_ERROR);
          setPhase("google");
          return;
        }

        const state = data as unknown as CabinetState;
        if (state.exists) {
          router.replace(deriveDestination(state));
          return;
        }
        if (user.phone && user.phone_confirmed_at) {
          const normalizedPhone = normalizeGeorgianPhone(user.phone);
          if (normalizedPhone !== null) {
            setPhoneInput(normalizedPhone);
            setConfirmedPhone(normalizedPhone);
          }
        }
        setPhase("form");
      } catch {
        if (!cancelled) {
          setFormError(GENERIC_FUNNEL_ERROR);
          setPhase("google");
        }
      }
    }

    void loadRegistrationState();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function applyValidationErrors(issues: ZodIssue[]) {
    const next: Partial<Record<FieldKey, string>> = {};
    let unmapped: string | undefined;
    for (const issue of issues) {
      const key = issue.path[0];
      if (isFieldKey(key)) next[key] = issue.message;
      else unmapped ??= issue.message;
    }
    setErrors(next);
    if (unmapped !== undefined) setFormError(unmapped);
  }

  function returnToGoogle(message?: string) {
    setFormError(message);
    setChallenge(undefined);
    setVerifiedPhone(undefined);
    setConfirmedPhone(undefined);
    setPhase("google");
  }

  function handleRegisterResult(result: GoogleRegistrationActionResult) {
    if (!result.ok) {
      if (isGoogleSessionError(result.code)) {
        returnToGoogle(result.error);
      } else {
        setFormError(result.error);
        setPhase("retry");
      }
      return;
    }

    if (result.state.exists && result.state.created === false) {
      setNotice("ეს ნომერი უკვე რეგისტრირებულია");
      redirectTimeoutRef.current = setTimeout(
        () => router.replace(deriveDestination(result.state)),
        1500,
      );
      return;
    }
    router.replace("/me");
  }

  function handlePreflightFailure(result: Extract<GoogleRegistrationActionResult, { ok: false }>) {
    if (isGoogleSessionError(result.code)) {
      returnToGoogle(result.error);
    } else {
      setFormError(result.error);
    }
  }

  async function submitForm() {
    setFormError(undefined);
    const parsed = registerSchema.safeParse({
      firstName,
      lastName,
      phone: phoneInput,
      refCode,
    });
    if (!parsed.success) {
      applyValidationErrors(parsed.error.issues);
      return;
    }

    setErrors({});
    setBusy(true);
    try {
      if (confirmedPhone === parsed.data.phone) {
        const registration = await registerGoogleAction({
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          refCode: parsed.data.refCode,
        });
        if (registration.ok) {
          handleRegisterResult(registration);
          return;
        }
        if (registration.code !== "phone_required") {
          handlePreflightFailure(registration);
          return;
        }
      }

      const result = await sendPhoneVerificationAction({ phone: parsed.data.phone });
      if (!result.ok) {
        if (result.code === "not_authenticated" || result.code === "google_required") {
          returnToGoogle(result.message);
        } else if (result.code === "invalid_phone") {
          setErrors({ phone: result.message });
        } else {
          setFormError(result.message);
        }
        return;
      }
      setPhone(result.phone);
      setChallenge({ challengeId: result.challengeId, expiresAt: result.expiresAt });
      setPhase("otp");
    } catch {
      setFormError(GENERIC_FUNNEL_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function registerVerifiedPhone() {
    try {
      const result = await registerGoogleAction({ firstName, lastName, refCode });
      handleRegisterResult(result);
    } catch {
      setFormError(GENERIC_FUNNEL_ERROR);
      setPhase("retry");
    }
  }

  async function afterPhoneVerified(provenPhone: string) {
    setVerifiedPhone(provenPhone);
    setFormError(undefined);
    try {
      const {
        data: { user },
        error,
      } = await createClient().auth.refreshSession();
      if (error || !user) {
        returnToGoogle(PHONE_VERIFICATION_MESSAGES.not_authenticated);
        return;
      }
    } catch {
      returnToGoogle(PHONE_VERIFICATION_MESSAGES.not_authenticated);
      return;
    }
    await registerVerifiedPhone();
  }

  async function submitRetry() {
    if (!verifiedPhone) {
      setPhase("form");
      return;
    }
    setFormError(undefined);
    const parsed = registerActionSchema.safeParse({ firstName, lastName, refCode });
    if (!parsed.success) {
      applyValidationErrors(parsed.error.issues);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const result = await registerGoogleAction(parsed.data);
      handleRegisterResult(result);
    } catch {
      setFormError(GENERIC_FUNNEL_ERROR);
    } finally {
      setBusy(false);
    }
  }

  function changePhone() {
    setChallenge(undefined);
    setVerifiedPhone(undefined);
    setPhone("");
    setFormError(undefined);
    setErrors({});
    setPhase("form");
  }

  const phoneStep = phase === "form" || phase === "otp" || phase === "retry";
  const currentStep = phoneStep ? ("phone" as const) : ("google" as const);

  return (
    <AuthEntryShell
      eyebrow={phoneStep ? "ნაბიჯი 2 — ტელეფონის დადასტურება" : "ნაბიჯი 1 — წევრის რეგისტრაცია"}
      title="შემოგვიერთდი ერთ წუთში"
      intro="Google-ით იწყებ, ტელეფონის ნომერს კი მხოლოდ ერთხელ ადასტურებ."
      progress={<AuthProgress currentStep={currentStep} />}
      asideTitle={phoneStep ? "რატომ ტელეფონი?" : "როგორ მუშაობს"}
      aside={
        phoneStep ? (
          <p>ნომერზე მიიღებ ერთჯერად SMS კოდს. შემდეგ შესვლისთვის მხოლოდ Google დაგჭირდება.</p>
        ) : (
          <ol className="flex list-decimal flex-col gap-2 pl-4">
            <li>Google-ით უსაფრთხოდ შედიხარ.</li>
            <li>ახალი წევრი ერთხელ ადასტურებს ტელეფონის ნომერს.</li>
            <li>შემდეგ პირდაპირ პირად კაბინეტში გადადიხარ.</li>
          </ol>
        )
      }
    >
      {notice ? (
        <p
          className="mb-5 border-l-2 border-brand bg-surface px-4 py-3 text-sm text-ink"
          data-testid="join-notice"
        >
          {notice}
        </p>
      ) : null}

      {phase === "loading" ? (
        <p role="status" className="text-sm text-muted-fg">
          მონაცემები იტვირთება…
        </p>
      ) : null}

      {phase === "google" ? (
        <div className="flex max-w-xl flex-col gap-4">
          <GoogleAuthButton nextPath={nextPath} label="Google-ით გაგრძელება" />
          {formError ? (
            <p role="alert" className="text-sm font-semibold text-danger">
              {formError}
            </p>
          ) : null}
        </div>
      ) : null}

      {phase === "otp" && challenge ? (
        <div className="flex max-w-xl flex-col gap-4">
          <PhoneVerification
            phone={phone}
            challengeId={challenge.challengeId}
            expiresAt={challenge.expiresAt}
            onChallengeChanged={setChallenge}
            onVerified={afterPhoneVerified}
          />
          <Button variant="ghost" size="sm" onClick={changePhone}>
            ნომრის შეცვლა
          </Button>
        </div>
      ) : null}

      {phase === "form" || phase === "retry" ? (
        <div className="flex max-w-2xl flex-col gap-4">
          <h2 className="font-serif font-bold border-b-2 border-ink pb-2">პირადი მონაცემები</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="სახელი"
              name="firstName"
              placeholder="მაგ. ნინო"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              error={errors.firstName}
            />
            <Field
              label="გვარი"
              name="lastName"
              placeholder="მაგ. ბერიძე"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              error={errors.lastName}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Field
              label="ტელეფონის ნომერი"
              name="phone"
              inputMode="tel"
              placeholder="+995 5XX XX XX XX"
              value={phoneInput}
              onChange={(event) => setPhoneInput(event.target.value)}
              error={errors.phone}
              disabled={phase === "retry"}
            />
            <p className="text-xs text-muted-fg">
              {phase === "retry"
                ? "ნომერი დადასტურებულია"
                : "Verify.ge ნომერს მიიღებს მხოლოდ რეგისტრაციის ერთჯერადი კოდის გასაგზავნად და დასადასტურებლად."}
            </p>
          </div>
          {formError ? (
            <p role="alert" className="text-sm font-semibold text-danger">
              {formError}
            </p>
          ) : null}
          <Button onClick={phase === "retry" ? submitRetry : submitForm} disabled={busy} size="lg">
            {phase === "retry" ? "დარეგისტრირება" : "კოდის მიღება"}
          </Button>
        </div>
      ) : null}
    </AuthEntryShell>
  );
}
