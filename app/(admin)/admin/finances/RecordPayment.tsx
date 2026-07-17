"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { adminControlClasses } from "@/components/Field";
import { Pill } from "@/components/Pill";
import { MEMBER_STATUS_LABELS_KA } from "@/lib/admin";
import { todayTbilisiIso } from "@/lib/admin-schemas";
import { monthsFor } from "@/lib/active";
import type { LookupResult, MemberCandidate, RecordResult } from "./types";

export function RecordPayment({
  lookup,
  record,
}: {
  lookup: (query: string) => Promise<LookupResult>;
  record: (input: {
    memberId: string;
    amountGel: number;
    paidAt: string;
    bankReference: string;
  }) => Promise<RecordResult>;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<MemberCandidate[] | null>(null);
  const [member, setMember] = useState<MemberCandidate | null>(null);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayTbilisiIso());
  const [bankReference, setBankReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const amountNum = Number(amount);
  const previewMonths = member?.tier ? monthsFor(amountNum, member.tier) : 0;

  async function onLookup() {
    setBusy(true);
    setNotice(null);
    setMember(null);
    const result = await lookup(query);
    setBusy(false);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error });
      setCandidates(null);
      return;
    }
    setCandidates(result.candidates);
  }

  async function onRecord() {
    if (!member) return;
    setBusy(true);
    setNotice(null);
    const result = await record({
      memberId: member.id,
      amountGel: amountNum,
      paidAt,
      bankReference: bankReference.trim(),
    });
    setBusy(false);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error });
      return;
    }
    setNotice({
      kind: "ok",
      text: `აღირიცხა — ${result.months} თვე${
        result.newStatus === "active_member" ? " · წევრი ახლა აქტიურია ✓" : ""
      }`,
    });
    setMember(null);
    setCandidates(null);
    setQuery("");
    setAmount("");
    setBankReference("");
    setPaidAt(todayTbilisiIso());
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
          წევრის ძებნა (GR-კოდი, სახელი ან ტელეფონი)
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="GR-XXXXXX…"
            className={adminControlClasses}
          />
        </label>
        <Button variant="dark" onClick={onLookup} disabled={busy || query.trim().length < 2}>
          ძებნა
        </Button>
      </div>

      {candidates !== null && !member ? (
        candidates.length === 0 ? (
          <p className="text-sm text-muted-fg">წევრი ვერ მოიძებნა.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setMember(c)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-brand"
              >
                <span className="font-semibold text-ink">
                  {c.name}
                  <span className="ms-2 font-mono text-xs text-muted-fg">{c.referenceCode}</span>
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-fg">
                  {c.regionNameKa ?? "—"} · {c.tier === null ? "—" : `${c.tier} ₾`}
                  <Pill status={c.status} label={MEMBER_STATUS_LABELS_KA[c.status]} />
                </span>
              </button>
            ))}
          </div>
        )
      ) : null}

      {member ? (
        <div className="rounded-xl border border-line bg-surface/50 p-4">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            {member.name} <span className="font-mono text-xs">{member.referenceCode}</span>
            <span className="font-normal text-muted-fg">{member.regionNameKa ?? "—"}</span>
            <span>· საწევრო: {member.tier === null ? "—" : `${member.tier} ₾`}</span>
            <Pill status={member.status} label={MEMBER_STATUS_LABELS_KA[member.status]} />
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex w-32 flex-col gap-1 text-sm font-semibold text-ink">
              თანხა (₾)
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="10000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="flex w-44 flex-col gap-1 text-sm font-semibold text-ink">
              თარიღი
              <input
                type="date"
                value={paidAt}
                max={todayTbilisiIso()}
                onChange={(e) => setPaidAt(e.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
              საბანკო რეფერენსი (არასავალდებულო)
              <input
                type="text"
                value={bankReference}
                maxLength={64}
                onChange={(e) => setBankReference(e.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
            <p className="pb-2 text-sm font-bold text-ink">
              {previewMonths > 0 ? `→ ${previewMonths} თვე` : "→ —"}
            </p>
            <Button variant="primary" onClick={onRecord} disabled={busy || previewMonths === 0}>
              აღრიცხვა
            </Button>
          </div>
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
