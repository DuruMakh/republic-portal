"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import type { ReassignResult } from "./actions";

export function ReassignRow({
  memberId,
  options,
  reassign,
}: {
  memberId: string;
  options: { id: string; name: string }[];
  reassign: (memberId: string, delegateId: string) => Promise<ReassignResult>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(options[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onReassign() {
    setBusy(true);
    setError(null);
    const result = await reassign(memberId, selected);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) return <span className="text-sm font-semibold text-ok">გადანაწილდა ✓</span>;
  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      {options.length === 0 ? (
        <span className="text-sm text-muted-fg">ამ მხარეს დამტკიცებული დელეგატი არ ჰყავს</span>
      ) : (
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="min-w-[200px] rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}
      <Button
        variant="primary"
        size="sm"
        onClick={onReassign}
        disabled={busy || options.length === 0}
      >
        გადანაწილება
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
