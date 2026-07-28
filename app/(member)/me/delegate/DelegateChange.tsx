"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { SelectField } from "@/components/Select";
import { changeDelegateSchema } from "@/lib/cabinet-schemas";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { changeDelegateAction } from "../actions";

const CENTRAL = "central";

export interface PickerDelegate {
  id: string;
  first_name: string;
  last_name: string;
  region_id: number | null;
}

export function DelegateChange({
  regions,
  delegates,
  currentDelegateId,
  initialRegionId,
}: {
  regions: { id: number; name_ka: string }[];
  delegates: PickerDelegate[];
  currentDelegateId: string | null;
  initialRegionId: number;
}) {
  const router = useRouter();
  const [regionId, setRegionId] = useState(initialRegionId);
  // Seed to the current delegate only if it's a visible (approved) option; a
  // no-longer-approved binding isn't in `delegates`, so seeding its id would leave
  // the controlled Select pointing at a missing <option> (blank, dead-end submit).
  const [choice, setChoice] = useState(
    currentDelegateId !== null && delegates.some((d) => d.id === currentDelegateId)
      ? currentDelegateId
      : CENTRAL,
  );
  const [message, setMessage] = useState<{ kind: "ok" | "error" | "info"; text: string }>();
  const [busy, setBusy] = useState(false);

  const options = useMemo(
    () => delegates.filter((d) => d.region_id === regionId),
    [delegates, regionId],
  );

  function changeRegion(nextRegionId: number) {
    setRegionId(nextRegionId);
    setChoice((prev) => {
      if (prev === CENTRAL) return prev;
      const visible = delegates.some((d) => d.region_id === nextRegionId && d.id === prev);
      return visible ? prev : CENTRAL;
    });
  }

  async function change() {
    setMessage(undefined);
    const selected = choice === CENTRAL ? null : choice;
    if (selected === currentDelegateId) {
      setMessage({ kind: "info", text: "ეს დელეგატი უკვე არჩეულია" });
      return; // the RPC would no-op anyway (spec §4.2) — save the round-trip
    }
    const parsed = changeDelegateSchema.safeParse({ delegateId: selected });
    if (!parsed.success) {
      setMessage({ kind: "error", text: parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR });
      return;
    }
    setBusy(true);
    let result: Awaited<ReturnType<typeof changeDelegateAction>>;
    try {
      result = await changeDelegateAction(parsed.data);
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
    setMessage({ kind: "ok", text: "დელეგატი შეიცვალა ✓" });
    router.refresh(); // current-delegate card + summary re-render server-side
  }

  return (
    <div className="flex flex-col gap-4">
      <SelectField
        label="რეგიონი"
        id="change-region"
        value={regionId}
        onChange={(e) => changeRegion(Number(e.target.value))}
      >
        {regions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name_ka}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="დელეგატი"
        id="change-delegate"
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
      >
        <option value={CENTRAL}>
          {currentDelegateId === null ? "არ მყავს დელეგატი (მიმდინარე)" : "არ მყავს დელეგატი"}
        </option>
        {options.map((d) => (
          <option key={d.id} value={d.id}>
            {d.first_name} {d.last_name}
            {d.id === currentDelegateId ? " (მიმდინარე)" : ""}
          </option>
        ))}
      </SelectField>
      <p className="text-xs text-muted-fg">
        აჩვენებს მხოლოდ დამტკიცებულ დელეგატებს არჩეულ რეგიონში.
      </p>
      {message ? (
        <p
          role="status"
          className={`text-sm font-semibold ${
            message.kind === "ok"
              ? "text-ok"
              : message.kind === "error"
                ? "text-danger"
                : "text-muted-fg"
          }`}
          data-testid="change-delegate-message"
        >
          {message.text}
        </p>
      ) : null}
      <Button className="w-full" onClick={change} disabled={busy}>
        დელეგატის შეცვლა
      </Button>
    </div>
  );
}
