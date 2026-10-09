"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { ACCOUNT_DELETION_CONFIRM_WORD } from "@/lib/account-deletion";
import {
  ACCOUNT_DELETE_BUSY,
  ACCOUNT_DELETE_BUTTON,
  ACCOUNT_DELETE_CONFIRM_LABEL,
  ACCOUNT_DELETE_DELEGATE_NOTE,
  ACCOUNT_DELETE_HEADING,
  ACCOUNT_DELETE_LEDE,
  ACCOUNT_DELETE_STAFF_NOTE,
} from "@/lib/account-deletion-copy";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";

/** Spec 2026-10-08 §3.1/§3.3: the profile page's danger section. */
export function DeleteAccountSection({
  isStaff,
  isDelegate,
  action,
}: {
  isStaff: boolean;
  isDelegate: boolean;
  action: (input: unknown) => Promise<{ ok: false; error: string }>;
}) {
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = word.trim() === ACCOUNT_DELETION_CONFIRM_WORD;

  async function onDelete() {
    setBusy(true);
    setError(null);
    let result: { ok: false; error: string };
    try {
      result = await action({ confirm: word });
    } catch (e) {
      // Success never resolves: the action redirects to /account-deleted, and Next's client
      // starts that navigation itself before rejecting the call with NEXT_REDIRECT. Rethrowing
      // would reach the app router's unhandled-rejection listener, which pushes the same URL a
      // second time; so the redirect ends here, still busy, the button disabled until the page
      // changes. Anything else is a real failure.
      if (e instanceof Error && e.message === "NEXT_REDIRECT") return;
      setError(GENERIC_FUNNEL_ERROR);
      setBusy(false);
      return;
    }
    if (result && !result.ok) setError(result.error);
    setBusy(false);
  }

  return (
    <Card title={ACCOUNT_DELETE_HEADING}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-prose">{ACCOUNT_DELETE_LEDE}</p>
        {isDelegate ? <p className="text-sm text-prose">{ACCOUNT_DELETE_DELEGATE_NOTE}</p> : null}
        {isStaff ? (
          <p className="text-sm font-semibold text-ink">{ACCOUNT_DELETE_STAFF_NOTE}</p>
        ) : (
          <>
            <Field
              label={ACCOUNT_DELETE_CONFIRM_LABEL}
              name="deleteConfirm"
              value={word}
              autoComplete="off"
              onChange={(e) => setWord(e.target.value)}
            />
            <div>
              <Button variant="danger" onClick={onDelete} disabled={!matches || busy}>
                {busy ? ACCOUNT_DELETE_BUSY : ACCOUNT_DELETE_BUTTON}
              </Button>
            </div>
            {error ? (
              <p role="alert" className="text-sm font-semibold text-danger">
                {error}
              </p>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}
