"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import type { VoidResult } from "./types";

export function VoidPaymentButton({
  paymentId,
  voidPayment,
}: {
  paymentId: number;
  voidPayment: (paymentId: number, reason: string) => Promise<VoidResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setBusy(true);
    setError(null);
    const result = await voidPayment(paymentId, reason.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh(); // the row re-renders server-side as გაუქმებული
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        გაუქმება
      </Button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1 text-xs font-semibold text-ink">
        მიზეზი
        <input
          type="text"
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-normal"
        />
      </label>
      <Button
        variant="danger"
        size="sm"
        onClick={onConfirm}
        disabled={busy || reason.trim().length < 3}
      >
        გაუქმების დადასტურება
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
        არა
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
