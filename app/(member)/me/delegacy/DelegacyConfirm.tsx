"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UnityButton } from "@/components/UnityButton";
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
        setBusy(false);
        return;
      }
      // stay busy: router.refresh() swaps in the pending card asynchronously, and a
      // re-enabled button would let a second click surface „delegacy_exists" for a
      // request that just succeeded
      router.refresh();
    } catch {
      setError(GENERIC_FUNNEL_ERROR);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <UnityButton
        variant="cream"
        className="w-full"
        onClick={confirm}
        disabled={busy}
        data-testid="delegacy-confirm"
      >
        მოთხოვნის გაგზავნა
      </UnityButton>
      {error ? <p className="m-0 text-[15px] font-bold text-limestone">{error}</p> : null}
    </div>
  );
}
