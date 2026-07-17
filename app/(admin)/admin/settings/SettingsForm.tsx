"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import { adminControlClasses } from "@/components/Field";
import { addDaysIso } from "@/lib/active";
import { formatDateKa } from "@/lib/cabinet";
import type { SettingsActionResult } from "./actions";

export function SettingsForm({
  initialGraceDays,
  save,
}: {
  initialGraceDays: number;
  save: (graceDays: number) => Promise<SettingsActionResult>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(initialGraceDays));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const days = Number(value);
  const valid = Number.isInteger(days) && days >= 0 && days <= 365;

  async function onSave() {
    if (!valid) {
      setNotice({ kind: "error", text: "მიუთითე რიცხვი 0-დან 365-მდე." });
      return;
    }
    setBusy(true);
    setNotice(null);
    const result = await save(days);
    setBusy(false);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error });
      return;
    }
    setNotice({ kind: "ok", text: "შენახულია ✓ — სტატუსები გადაითვალა." });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink">
        წევრი აქტიურია გადახდილი პერიოდის ბოლოდან{" "}
        {/* the whole dynamic phrase stays inside one element (spec §3.9 live example;
            house lesson from RecordPayment.tsx: text split across tags breaks text matchers) */}
        <strong>კიდევ {valid ? days : "—"} დღე</strong>. მაგალითად: 20 ₾ (ერთი თვის საწევრო),
        გადახდილი 1 ივლისს, ფარავს 31 ივლისამდე → აქტიურია{" "}
        <strong>{valid ? `${formatDateKa(addDaysIso("2026-07-31", days))}-მდე` : "—"}</strong>.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex w-56 flex-col gap-1 text-sm font-semibold text-ink">
          დამატებითი დღეები (0–365)
          <input
            type="number"
            min={0}
            max={365}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={adminControlClasses}
          />
        </label>
        <Button variant="primary" onClick={onSave} disabled={busy}>
          შენახვა
        </Button>
      </div>
      <p className="text-xs text-muted-fg">
        შენახვისას ყველა წევრის სტატუსი მაშინვე გადაითვლება ახალი წესით.
      </p>
      {notice ? (
        <p className={`text-sm font-semibold ${notice.kind === "ok" ? "text-ok" : "text-danger"}`}>
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}
