"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import { adminControlClasses } from "@/components/Field";
import { ADMIN_ROLE_VALUES, ROLE_DUTIES_KA, ROLE_LABELS_KA, type AdminRole } from "@/lib/admin";
import type { AdminCandidateResult, AdminRoleActionResult } from "./actions";

export function GrantRoleForm({
  find,
  grant,
}: {
  find: (phone: string) => Promise<AdminCandidateResult>;
  grant: (userId: string, role: AdminRole) => Promise<AdminRoleActionResult>;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [candidate, setCandidate] = useState<{ id: string; name: string } | null>(null);
  const [searched, setSearched] = useState(false);
  const [role, setRole] = useState<AdminRole>("verifier");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function onFind() {
    setBusy(true);
    setNotice(null);
    setCandidate(null);
    const result = await find(phone);
    setBusy(false);
    setSearched(true);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error });
      return;
    }
    setCandidate(result.candidate);
  }

  async function onGrant() {
    if (!candidate) return;
    setBusy(true);
    setNotice(null);
    const result = await grant(candidate.id, role);
    setBusy(false);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error });
      return;
    }
    setNotice({ kind: "ok", text: `როლი მიენიჭა ✓ — ${candidate.name}` });
    setCandidate(null);
    setPhone("");
    setSearched(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
          ტელეფონი (რეგისტრირებული წევრის)
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="5XX XX XX XX"
            className={adminControlClasses}
          />
        </label>
        <Button variant="dark" onClick={onFind} disabled={busy || phone.trim().length < 9}>
          მოძებნა
        </Button>
      </div>

      {searched && !candidate && !notice ? (
        <p className="text-sm text-muted-fg">
          წევრი ვერ მოიძებნა — ადმინი ჯერ უნდა დარეგისტრირდეს პლატფორმაზე.
        </p>
      ) : null}

      {candidate ? (
        <div className="flex flex-wrap items-end gap-3 border border-hairline bg-surface/50 p-4">
          <p className="text-sm font-bold text-ink">{candidate.name}</p>
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
            როლი
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className={adminControlClasses}
            >
              {ADMIN_ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS_KA[r]} — {ROLE_DUTIES_KA[r]}
                </option>
              ))}
            </select>
          </label>
          <Button variant="primary" onClick={onGrant} disabled={busy}>
            მინიჭება
          </Button>
        </div>
      ) : null}

      {notice ? (
        <p className={`text-sm font-semibold ${notice.kind === "ok" ? "text-ok" : "text-danger"}`}>
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}
