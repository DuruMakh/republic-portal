"use client";
import { useCopy } from "@/lib/i18n/copy";

import { useEffect, useRef, useState } from "react";
import Link from "@/lib/i18n/navigation";
import { useRouter } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import type { ZodIssue } from "zod";
import { AuthAsideSteps, AuthEntryShell } from "@/components/AuthEntryShell";
import { AuthProgress } from "@/components/AuthProgress";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { PhoneVerification } from "@/components/PhoneVerification";
import { PrivacyConsentField } from "@/components/PrivacyConsentField";
import { UnityButton } from "@/components/UnityButton";
import { UnityField } from "@/components/UnityField";
import { deriveDestination } from "@/lib/cabinet";
import { GENERIC_FUNNEL_ERROR, isReferralCodeCandidate, type CabinetState } from "@/lib/funnel";
import { registerActionSchema, registerSchema } from "@/lib/funnel-schemas";
import { PHONE_VERIFICATION_MESSAGES } from "@/lib/phone-verification/contracts";
import { PRIVACY_CONSENT_REQUIRED_MESSAGE, PRIVACY_POLICY_PATH } from "@/lib/privacy";
import { createClient } from "@/lib/supabase/client";
import { parseRegistrationPhone } from "@/lib/phone-number";
import {
  registerGoogleAction,
  type GoogleRegistrationActionResult,
  type GoogleRegistrationFailureCode,
} from "./google-actions";
import { sendPhoneVerificationAction } from "./phone-actions";

type GoogleJoinPhase = "loading" | "google" | "form" | "otp" | "retry";
type Challenge = { challengeId: string; expiresAt: string };

const FIELD_KEYS = ["firstName", "lastName", "phone", "privacyConsent"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

function isFieldKey(key: unknown): key is FieldKey {
  return typeof key === "string" && (FIELD_KEYS as readonly string[]).includes(key);
}

function isGoogleSessionError(code: GoogleRegistrationFailureCode): boolean {
  return code === "not_authenticated" || code === "google_required";
}

export function GoogleJoinForm() {
  const t = useCopy();
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
  const [privacyConsent, setPrivacyConsent] = useState(false);
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
          // auth stores the confirmed number without "+"
          const stored = user.phone.startsWith("+") ? user.phone : `+${user.phone}`;
          const confirmed = parseRegistrationPhone(stored);
          if (confirmed.ok) {
            setPhoneInput(confirmed.phone);
            setConfirmedPhone(confirmed.phone);
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
        // a consent refusal belongs under the box, where ticking clears it
        if (result.error === PRIVACY_CONSENT_REQUIRED_MESSAGE) {
          setErrors({ privacyConsent: result.error });
        } else {
          setFormError(result.error);
        }
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
      privacyConsent,
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
          privacyConsent: parsed.data.privacyConsent,
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

      const result = await sendPhoneVerificationAction({
        phone: parsed.data.phone,
        privacyConsent: parsed.data.privacyConsent,
      });
      if (!result.ok) {
        if (result.code === "not_authenticated" || result.code === "google_required") {
          returnToGoogle(result.message);
        } else if (result.code === "invalid_phone" || result.code === "country_not_supported") {
          setErrors({ phone: result.message });
        } else if (result.code === "privacy_consent_required") {
          setErrors({ privacyConsent: result.message });
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
      const result = await registerGoogleAction({ firstName, lastName, refCode, privacyConsent });
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
    const parsed = registerActionSchema.safeParse({
      firstName,
      lastName,
      refCode,
      privacyConsent,
    });
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
      eyebrow={
        phoneStep ? t("ნაბიჯი 2 — ტელეფონის დადასტურება") : t("ნაბიჯი 1 — მხარდამჭერად რეგისტრაცია")
      }
      title={t("შემოგვიერთდი")}
      intro={t("Google-ით იწყებ, ტელეფონის ნომერს კი მხოლოდ ერთხელ ადასტურებ.")}
      progress={<AuthProgress currentStep={currentStep} />}
      asideTitle={phoneStep ? t("რატომ ტელეფონი?") : t("როგორ მუშაობს")}
      aside={
        phoneStep ? (
          <p>
            {t("ნომერზე მიიღებ ერთჯერად SMS კოდს. შემდეგ შესვლისთვის მხოლოდ Google დაგჭირდება.")}
          </p>
        ) : (
          <AuthAsideSteps
            steps={[
              t("Google-ით უსაფრთხოდ შედიხარ."),
              t("ერთხელ ადასტურებ ტელეფონის ნომერს."),
              t("ხდები მხარდამჭერი და გადადიხარ პირად კაბინეტში."),
              t("თუ წევრობა გინდა, კაბინეტში ავსებ უფრო ვრცელ კითხვარს."),
            ]}
            highlight={2}
          />
        )
      }
      compact={phoneStep}
    >
      {notice ? (
        <p
          className="mb-6 border-l-4 border-brand bg-sandstone px-[18px] py-3.5 text-[15px] font-semibold text-ink"
          data-testid="join-notice"
        >
          {t(notice ?? "")}
        </p>
      ) : null}

      {phase === "loading" ? (
        <p role="status" className="text-[16px] text-secondary">
          {t("მონაცემები იტვირთება…")}
        </p>
      ) : null}

      {phase === "google" ? (
        <div className="flex flex-col gap-4">
          <GoogleAuthButton nextPath={nextPath} label={t("Google-ით გაგრძელება")} />
          <p className="text-[14.5px] leading-[1.6] text-secondary">
            {t("Google-ით გაგრძელებით ეთანხმები ჩვენს")}{" "}
            <Link
              href={PRIVACY_POLICY_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-brand underline decoration-1 underline-offset-[5px] hover:text-brand-dark"
            >
              {t("კონფიდენციალურობის პოლიტიკას")}
            </Link>
            .
          </p>
          {formError ? (
            <p role="alert" className="text-[15px] font-semibold text-danger">
              {t(formError ?? "")}
            </p>
          ) : null}
        </div>
      ) : null}

      {phase === "otp" && challenge ? (
        <div className="flex flex-col gap-3.5">
          <PhoneVerification
            phone={phone}
            challengeId={challenge.challengeId}
            expiresAt={challenge.expiresAt}
            onChallengeChanged={setChallenge}
            onVerified={afterPhoneVerified}
          />
          <UnityButton variant="ghost" size="sm" onClick={changePhone} className="w-full">
            {t("ნომრის შეცვლა")}
          </UnityButton>
        </div>
      ) : null}

      {phase === "form" || phase === "retry" ? (
        <div className="flex flex-col gap-[26px] sm:gap-[30px]">
          <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
            <UnityField
              label={t("სახელი")}
              name="firstName"
              placeholder={t("მაგ. ნინო")}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              error={t(errors.firstName ?? "")}
            />
            <UnityField
              label={t("გვარი")}
              name="lastName"
              placeholder={t("მაგ. ბერიძე")}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              error={t(errors.lastName ?? "")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <UnityField
              label={t("ტელეფონის ნომერი")}
              name="phone"
              inputMode="tel"
              placeholder="+995 5XX XX XX XX"
              value={phoneInput}
              onChange={(event) => setPhoneInput(event.target.value)}
              error={t(errors.phone ?? "")}
              disabled={phase === "retry"}
            />
            <p className="text-[13.5px] leading-[1.55] text-secondary">
              {phase === "retry"
                ? t("ნომერი დადასტურებულია")
                : t(
                    "SMS სერვისი ნომერს მიიღებს მხოლოდ რეგისტრაციის ერთჯერადი კოდის გასაგზავნად და დასადასტურებლად. საზღვარგარეთის ნომერი შეიყვანე ქვეყნის კოდით, მაგ. +49 …",
                  )}
            </p>
          </div>
          <PrivacyConsentField
            checked={privacyConsent}
            onChange={(checked) => {
              setPrivacyConsent(checked);
              if (checked) setErrors((prev) => ({ ...prev, privacyConsent: undefined }));
            }}
            error={t(errors.privacyConsent ?? "")}
          />
          {formError ? (
            <p role="alert" className="text-[15px] font-semibold text-danger">
              {t(formError ?? "")}
            </p>
          ) : null}
          <UnityButton
            onClick={phase === "retry" ? submitRetry : submitForm}
            disabled={busy}
            className="w-full"
          >
            {phase === "retry" ? t("დარეგისტრირება") : t("კოდის მიღება")}
          </UnityButton>
        </div>
      ) : null}
    </AuthEntryShell>
  );
}
