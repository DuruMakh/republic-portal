"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Field, TextareaField } from "@/components/Field";
import {
  SUPPORT_EMAIL_LABEL,
  SUPPORT_FAILURE,
  SUPPORT_MESSAGE_LABEL,
  SUPPORT_NAME_LABEL,
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

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
      return;
    }

    setBusy(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const result = await submit(input);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setSent(true);
    } catch {
      // A server action rejects on network loss and on a stale action id after
      // a redeploy. Without this the button stayed disabled forever with no
      // message, and the typed text was recoverable only by a reload.
      setFormError(SUPPORT_FAILURE);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return <p className="font-serif text-[1.02rem] text-prose">{SUPPORT_SUCCESS}</p>;
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
      <Field
        label={SUPPORT_NAME_LABEL}
        value={name}
        error={fieldErrors.name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
      />
      <Field
        label={SUPPORT_EMAIL_LABEL}
        type="email"
        value={email}
        error={fieldErrors.email}
        onChange={(e) => setEmail(e.target.value)}
        maxLength={120}
      />
      <Field
        label={SUPPORT_PHONE_LABEL}
        type="tel"
        value={phone}
        error={fieldErrors.phone}
        onChange={(e) => setPhone(e.target.value)}
        maxLength={40}
      />
      <TextareaField
        label={SUPPORT_MESSAGE_LABEL}
        value={message}
        error={fieldErrors.message}
        onChange={(e) => setMessage(e.target.value)}
        rows={7}
        maxLength={2000}
      />
      {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      <div>
        <Button type="submit" disabled={busy}>
          {SUPPORT_SUBMIT_LABEL}
        </Button>
      </div>
    </form>
  );
}
