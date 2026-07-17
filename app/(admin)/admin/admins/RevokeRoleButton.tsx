"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminRole } from "@/lib/admin";
import type { AdminRoleActionResult } from "./actions";

export function RevokeRoleButton({
  userId,
  role,
  revoke,
}: {
  userId: string;
  role: AdminRole;
  revoke: (userId: string, role: AdminRole) => Promise<AdminRoleActionResult>;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRevoke() {
    setBusy(true);
    setError(null);
    const result = await revoke(userId, role);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setConfirming(false);
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-1">
      {confirming ? (
        <>
          <button
            type="button"
            onClick={onRevoke}
            disabled={busy}
            className="rounded px-1.5 text-xs font-bold text-danger hover:underline"
          >
            მოხსნა
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded px-1.5 text-xs text-muted-fg hover:underline"
          >
            არა
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="როლის მოხსნა"
          title="როლის მოხსნა"
          className="rounded px-1 text-xs font-bold text-muted-fg hover:text-danger"
        >
          ✕
        </button>
      )}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
