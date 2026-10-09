"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/Button";
import { adminControlClasses, Field, TextareaField } from "@/components/Field";
import { normalizeName } from "@/lib/account-deletion";
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_DELETE_CANCEL,
  ADMIN_DELETE_CONFIRM,
  ADMIN_DELETE_DONE,
  ADMIN_DELETE_NAME_LABEL,
  ADMIN_DELETE_NAME_MISMATCH,
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
 *
 * The deleted row leaves the list in the same pass that the action's revalidation refreshes it,
 * and this component goes with it, so "deleted" cannot be told from here. On success the URL
 * gains ?deleted=1 (every other parameter kept) and the page shows the notice above the list.
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hintId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [typedName, setTypedName] = useState("");
  const [nameLeft, setNameLeft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // normalized on both sides: the page shows two spaces, or a non-breaking one, as one space
  const typedNormalized = normalizeName(typedName);
  const nameMatches = typedNormalized.length > 0 && typedNormalized === normalizeName(memberName);
  const canConfirm = !busy && reason.trim().length >= REASON_MIN && nameMatches;

  function close() {
    setOpen(false);
    setReason("");
    setTypedName("");
    setNameLeft(false);
    setError(null);
  }

  /** The list-level "deleted" notice; the deletion is done, so nothing here may fail it. */
  function announceDeletion() {
    try {
      const next = new URLSearchParams(searchParams.toString());
      next.set("deleted", "1");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    } catch (e) {
      console.error("member deletion: could not add the deleted notice to the URL", e);
    }
  }

  async function onConfirm() {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    let deleted = false;
    try {
      const result = await action(memberId, reason, typedName, memberName);
      if (result.ok) deleted = true;
      else setError(result.error);
    } catch {
      setError(GENERIC_FUNNEL_ERROR);
    } finally {
      setBusy(false);
    }
    if (deleted) {
      close();
      setDone(true);
      announceDeletion();
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
          autoFocus
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
        error={
          nameLeft && typedNormalized.length > 0 && !nameMatches
            ? ADMIN_DELETE_NAME_MISMATCH
            : undefined
        }
        className={adminControlClasses}
        onChange={(e) => setTypedName(e.target.value)}
        onBlur={() => setNameLeft(true)}
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
