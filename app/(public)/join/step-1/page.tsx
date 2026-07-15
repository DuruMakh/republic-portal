"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { OtpVerification } from "@/components/OtpVerification";
import { Stepper } from "@/components/Stepper";
import {
  deriveFunnelStep,
  funnelRoute,
  isReferralCodeCandidate,
  type FunnelRole,
} from "@/lib/funnel";
import { contactSchema } from "@/lib/funnel-schemas";
import { createClient } from "@/lib/supabase/client";
import { funnelStartAction } from "../actions";
import { useFunnelGuard } from "../useFunnelGuard";

function Step1() {
  const router = useRouter();
  const params = useSearchParams();
  const role: FunnelRole = params.get("role") === "delegate" ? "delegate" : "member";
  const refParam = params.get("ref");
  const refCode = refParam && isReferralCodeCandidate(refParam) ? refParam : null;

  // forwards signed-in users who are already past step 1
  useFunnelGuard("step-1");

  const [phase, setPhase] = useState<"contact" | "otp">("contact");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"firstName" | "lastName" | "phone", string>>>(
    {},
  );
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submitContact() {
    setFormError(undefined);
    const parsed = contactSchema.safeParse({ firstName, lastName, phone: phoneInput });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "firstName" || key === "lastName" || key === "phone") next[key] = issue.message;
      }
      setErrors(next);
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

  async function afterVerify() {
    const result = await funnelStartAction({ firstName, lastName, role, refCode });
    if (!result.ok) {
      setFormError(result.error);
      setPhase("contact");
      return;
    }
    if (result.state.completed) {
      // duplicate registration — only revealed after proving phone ownership (spec §6)
      setNotice("ეს ნომერი უკვე რეგისტრირებულია");
      setTimeout(() => router.replace(funnelRoute(deriveFunnelStep(result.state))), 1500);
      return;
    }
    router.replace(funnelRoute(deriveFunnelStep(result.state)));
  }

  return (
    <main className="mx-auto max-w-xl px-6 pb-16 pt-8">
      <div className="mb-6 flex justify-center">
        <Stepper current={1} />
      </div>
      <Card>
        <p className="text-xs font-bold uppercase tracking-widest text-brand">
          {role === "delegate" ? "დელეგატის რეგისტრაცია" : "წევრის რეგისტრაცია"}
        </p>
        <h2 className="mt-1 text-xl font-bold text-ink">სწრაფი კონტაქტი</h2>
        <p className="mb-5 mt-1 text-sm text-muted-fg">
          დავიწყოთ ძირითადით. მონაცემები ავტომატურად ინახება ყოველ ნაბიჯზე.
        </p>
        {notice ? (
          <p className="mb-4 rounded-lg bg-info/10 p-3 text-sm text-info" data-testid="join-notice">
            {notice}
          </p>
        ) : null}
        {phase === "contact" ? (
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
                label="ტელეფონის ნომერი"
                name="phone"
                inputMode="tel"
                placeholder="+995 5XX XX XX XX"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                error={errors.phone}
              />
              <p className="text-xs text-muted-fg">
                ამ ნომერზე მოგივა ერთჯერადი SMS კოდი დასადასტურებლად.
              </p>
            </div>
            {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            <Button onClick={submitContact} disabled={busy} size="lg">
              გაგრძელება →
            </Button>
            <p className="text-center text-xs text-muted-fg">
              💾 მონაცემები ინახება ავტომატურად (Draft)
            </p>
          </div>
        ) : (
          <OtpVerification phone={phone} onVerified={afterVerify} />
        )}
      </Card>
    </main>
  );
}

export default function Step1Page() {
  return (
    <Suspense fallback={null}>
      <Step1 />
    </Suspense>
  );
}
