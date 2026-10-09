"use client";

import { useId, useState } from "react";
import { Button } from "@/components/Button";
import { adminControlClasses, Field, TextareaField } from "@/components/Field";
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_DELETE_CANCEL,
  ADMIN_DELETE_CONFIRM,
  ADMIN_DELETE_DONE,
  ADMIN_DELETE_NAME_LABEL,
  ADMIN_DELETE_REASON_HINT,
  ADMIN_DELETE_REASON_LABEL,
} from "@/lib/account-deletion-copy";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import type { deleteMemberAction } from "./delete-member-actions";

/** adminDeleteMemberSchema's bounds (lib/account-deletion.ts); the RPC enforces them too. */
const REASON_MIN = 5;
const REASON_MAX = 300;

/**
 * Spec 2026-10-08 §3.4: a super_admin's "delete on request" for one member row. The form is
 * hidden until the row's button is clicked; confirming needs a reason and the member's name
 * typed back (a guard against deleting the wrong row: authorization is the RPC's).
 *
 * Every await sits in try/catch/finally: an action that throws must not leave the panel stuck
 * in its busy state (the admin "frozen button" of the launch audit, ADMIN-7).
 */
export function DeleteMemberButton({
  memberId,
  memberName,
  action,
}: {
  memberId: string;
  memberName: string;
  action: typeof deleteMemberAction;
}) {
  const hintId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [typedName, setTypedName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canConfirm =
    !busy &&
    reason.trim().length >= REASON_MIN &&
    typedName.trim().length > 0 &&
    typedName.trim() === memberName.trim();

  function close() {
    setOpen(false);
    setReason("");
    setTypedName("");
    setError(null);
  }

  async function onConfirm() {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      const result = await action(memberId, reason, typedName, memberName);
      if (result.ok) {
        close();
        setDone(true);
      } else {
        setError(result.error);
      }
    } catch {
      setError(GENERIC_FUNNEL_ERROR);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="text-xs font-semibold text-ok">
        {ADMIN_DELETE_DONE}
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        {ADMIN_DELETE_BUTTON}
      </Button>
    );
  }

  return (
    <div className="flex min-w-72 flex-col gap-3 border border-hairline bg-surface/50 p-4">
      <div className="flex flex-col gap-1">
        <TextareaField
          label={ADMIN_DELETE_REASON_LABEL}
          value={reason}
          rows={3}
          maxLength={REASON_MAX}
          disabled={busy}
          aria-describedby={hintId}
          className={`${adminControlClasses} min-h-20`}
          onChange={(e) => setReason(e.target.value)}
        />
        <p id={hintId} className="text-xs text-muted-fg">
          {ADMIN_DELETE_REASON_HINT}
        </p>
      </div>
      <Field
        label={ADMIN_DELETE_NAME_LABEL}
        value={typedName}
        autoComplete="off"
        disabled={busy}
        className={adminControlClasses}
        onChange={(e) => setTypedName(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="danger" size="sm" onClick={onConfirm} disabled={!canConfirm}>
          {ADMIN_DELETE_CONFIRM}
        </Button>
        <Button variant="ghost" size="sm" onClick={close} disabled={busy}>
          {ADMIN_DELETE_CANCEL}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
