"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Field, inputClasses } from "@/components/Field";
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

export function SupportForm({
  submit,
}: {
  submit: (input: unknown) => Promise<SupportActionResult>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const input = { name, email, phone, message };
    // Client-side parse is UX only -- the action re-parses and the RPC
    // re-checks. It exists so a missing contact is named before a round trip.
    const parsed = supportMessageSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? SUPPORT_FAILURE);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await submit(input);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return <p className="font-serif text-[1.02rem] text-prose">{SUPPORT_SUCCESS}</p>;
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
      <Field
        label={SUPPORT_NAME_LABEL}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
      />
      <Field
        label={SUPPORT_EMAIL_LABEL}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        maxLength={120}
      />
      <Field
        label={SUPPORT_PHONE_LABEL}
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        maxLength={40}
      />
      <label className="flex flex-col gap-1.5">
        <span className="block text-[0.74rem] font-bold tracking-[.08em] text-muted-fg mb-1">
          {SUPPORT_MESSAGE_LABEL}
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          maxLength={2000}
          className={`${inputClasses} h-auto resize-y py-2`}
        />
      </label>
      {error ? <p className="text-[0.8rem] text-brand">{error}</p> : null}
      <div>
        <Button type="submit" disabled={busy}>
          {SUPPORT_SUBMIT_LABEL}
        </Button>
      </div>
    </form>
  );
}
