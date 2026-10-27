"use client";

import { useCopy } from "@/lib/i18n/copy";
import { useLocale } from "next-intl";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { UnityButton } from "@/components/UnityButton";
import { UnityField, UnityTextareaField } from "@/components/UnityField";
import {
  SUPPORT_EMAIL_LABEL,
  SUPPORT_FAILURE,
  SUPPORT_MESSAGE_LABEL,
  SUPPORT_NAME_LABEL,
  SUPPORT_OPTIONAL_HINT,
  SUPPORT_PHONE_LABEL,
  SUPPORT_SUBMIT_LABEL,
  SUPPORT_SUCCESS,
} from "@/lib/support-copy";
import { supportMessageSchema } from "@/lib/support-schemas";
import type { SupportActionResult } from "./actions";

type FieldName = "name" | "email" | "phone" | "message";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly FieldName[] = ["name", "email", "phone", "message"];

export function SupportForm({
  submit,
}: {
  submit: (input: unknown) => Promise<SupportActionResult>;
}) {
  const t = useCopy();
  const english = useLocale() === "en";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  useEffect(() => {
    if (!focusRequest) return;
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled), [role="alert"]')
      ?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (sent) successRef.current?.focus();
  }, [sent]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const input = { name, email, phone, message };
    // Client-side parse is UX only -- the action re-parses and the RPC
    // re-checks. It exists so a problem is named without a round trip.
    const parsed = supportMessageSchema.safeParse(input);
    if (!parsed.success) {
      // Attach each issue to its field. Previously only issues[0] was shown, in
      // one paragraph with no field association, so a visitor with two problems
      // learned about them one round trip at a time and a screen reader was
      // told a message failed without being told which control it belonged to.
      const next: FieldErrors = {};
      let unattached: string | null = null;
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && (FIELD_NAMES as readonly string[]).includes(key)) {
          next[key as FieldName] ??= issue.message;
        } else {
          unattached ??= issue.message;
        }
      }
      setFieldErrors(next);
      setFormError(unattached);
      setFocusRequest((n) => n + 1);
      return;
    }

    setBusy(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const result = await submit(input);
      if (!result.ok) {
        setFormError(result.error);
        setFocusRequest((n) => n + 1);
        return;
      }
      setSent(true);
    } catch {
      // A server action rejects on network loss and on a stale action id after
      // a redeploy. Without this the button stayed disabled forever with no
      // message, and the typed text was recoverable only by a reload.
      setFormError(SUPPORT_FAILURE);
      setFocusRequest((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p
        ref={successRef}
        tabIndex={-1}
        className="m-0 font-serif text-[19px] leading-[1.6] text-prose"
      >
        {t(SUPPORT_SUCCESS)}
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-[26px] sm:gap-[30px]"
      onSubmit={onSubmit}
      noValidate
    >
      <UnityField
        label={english ? "Name" : SUPPORT_NAME_LABEL}
        value={name}
        error={fieldErrors.name ? t(fieldErrors.name) : undefined}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        maxLength={60}
      />
      <div className="grid gap-[26px] sm:grid-cols-2 sm:gap-8">
        <UnityField
          label={t(SUPPORT_EMAIL_LABEL)}
          hint={t(SUPPORT_OPTIONAL_HINT)}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          error={fieldErrors.email ? t(fieldErrors.email) : undefined}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={120}
        />
        <UnityField
          label={t(SUPPORT_PHONE_LABEL)}
          hint={t(SUPPORT_OPTIONAL_HINT)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          error={fieldErrors.phone ? t(fieldErrors.phone) : undefined}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={40}
        />
      </div>
      <UnityTextareaField
        label={t(SUPPORT_MESSAGE_LABEL)}
        value={message}
        error={fieldErrors.message ? t(fieldErrors.message) : undefined}
        onChange={(e) => setMessage(e.target.value)}
        rows={7}
        maxLength={2000}
        footer={
          <span className="self-end font-serif text-[13.5px] text-secondary">
            {message.length} / 2000
          </span>
        }
      />
      {formError ? (
        <p role="alert" tabIndex={-1} className="m-0 text-[15px] font-semibold text-brand">
          {t(formError)}
        </p>
      ) : null}
      <UnityButton type="submit" disabled={busy} className="w-full">
        {t(SUPPORT_SUBMIT_LABEL)}
      </UnityButton>
    </form>
  );
}
