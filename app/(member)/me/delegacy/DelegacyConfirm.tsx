"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { requestDelegacyAction } from "./actions";

export function DelegacyConfirm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setError(undefined);
    setBusy(true);
    try {
      const result = await requestDelegacyAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError(GENERIC_FUNNEL_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={confirm} disabled={busy} data-testid="delegacy-confirm">
        მოთხოვნის გაგზავნა
      </Button>
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
