"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { adminControlClasses } from "@/components/Field";
import type { SaveProfileResult } from "./actions";

/**
 * Security audit M2 (decision D3): approved delegates cannot rename themselves, so the
 * correction of a public name happens here, recorded in the audit log by the RPC.
 */
export function DelegateNameForm({
  delegateId,
  initialFirstName,
  initialLastName,
  save,
}: {
  delegateId: string;
  initialFirstName: string;
  initialLastName: string;
  save: (input: {
    delegateId: string;
    firstName: string;
    lastName: string;
  }) => Promise<SaveProfileResult>;
}) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    setBusy(true);
    const result = await save({ delegateId, firstName, lastName });
    setBusy(false);
    if (result.ok) setNotice({ kind: "ok", text: "სახელი განახლდა ✓" });
    else setNotice({ kind: "error", text: result.error });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
        სახელი
        <input
          name="firstName"
          value={firstName}
          maxLength={60}
          onChange={(e) => setFirstName(e.target.value)}
          className={adminControlClasses}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
        გვარი
        <input
          name="lastName"
          value={lastName}
          maxLength={60}
          onChange={(e) => setLastName(e.target.value)}
          className={adminControlClasses}
        />
      </label>
      <div>
        <Button type="submit" variant="primary" disabled={busy}>
          სახელის შენახვა
        </Button>
      </div>
      {notice ? (
        <p className={`text-sm ${notice.kind === "ok" ? "text-ok" : "text-danger"}`}>
          {notice.text}
        </p>
      ) : null}
    </form>
  );
}
