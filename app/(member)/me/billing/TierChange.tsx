"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { TierPicker } from "@/components/TierPicker";
import { GENERIC_FUNNEL_ERROR, type Tier } from "@/lib/funnel";
import { tierSchema } from "@/lib/funnel-schemas";
import { changeTierAction } from "../actions";

export function TierChange({ currentTier }: { currentTier: Tier }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<Tier>(currentTier);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string }>();
  const [busy, setBusy] = useState(false);

  async function save() {
    setMessage(undefined);
    const parsed = tierSchema.safeParse({ tier });
    if (!parsed.success) {
      setMessage({ kind: "error", text: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR });
      return;
    }
    setBusy(true);
    let result: Awaited<ReturnType<typeof changeTierAction>>;
    try {
      result = await changeTierAction(parsed.data);
    } catch {
      setMessage({ kind: "error", text: GENERIC_FUNNEL_ERROR });
      return;
    } finally {
      setBusy(false);
    }
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setOpen(false);
    setMessage({ kind: "ok", text: "საწევრო შეიცვალა ✓" });
    router.refresh(); // instructions block re-renders with the new amount
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xl font-extrabold text-ink" data-testid="current-tier">
          შენი საწევრო: {currentTier} ₾{" "}
          <span className="text-sm font-semibold text-muted-fg">/ თვეში</span>
        </p>
        {!open ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(true);
              setMessage(undefined);
            }}
          >
            შეცვლა
          </Button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-4 flex flex-col gap-3">
          <TierPicker value={tier} onChange={setTier} />
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy}>
              შენახვა
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setTier(currentTier);
                setMessage(undefined);
              }}
              disabled={busy}
            >
              გაუქმება
            </Button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p
          role="status"
          className={`mt-3 text-sm font-semibold ${message.kind === "ok" ? "text-ok" : "text-danger"}`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
