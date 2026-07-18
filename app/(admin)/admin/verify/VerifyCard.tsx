"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { adminControlClasses } from "@/components/Field";
import { Pill } from "@/components/Pill";
import { formatDateKa, formatPhoneKa, initialsKa } from "@/lib/cabinet";
import { RevealPersonalId } from "../members/RevealPersonalId";
import type { ApproveResult, RevealResult, VerifyActionResult } from "./actions";

export interface QueueApplicant {
  id: string;
  firstName: string;
  lastName: string;
  regionNameKa: string | null;
  phone: string | null;
  createdAt: string;
  reviewNote: string | null;
  verifiedAt: string | null; // decision stamp (spec §3.4 — rejected tab)
  verifiedByName: string | null;
}

export function VerifyCard({
  applicant,
  mode,
  reveal,
  approve,
  reject,
}: {
  applicant: QueueApplicant;
  mode: "pending" | "rejected";
  reveal: (delegateId: string) => Promise<RevealResult>;
  approve: (delegateId: string) => Promise<ApproveResult>;
  reject: (delegateId: string, note: string) => Promise<VerifyActionResult>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<
    { kind: "approved"; slug: string } | { kind: "rejected" } | null
  >(null);

  async function onApprove() {
    setBusy(true);
    setError(null);
    const result = await approve(applicant.id);
    setBusy(false);
    if (result.ok) setDone({ kind: "approved", slug: result.slug });
    else setError(result.error);
  }

  async function onReject() {
    setBusy(true);
    setError(null);
    const result = await reject(applicant.id, note.trim());
    setBusy(false);
    if (result.ok) setDone({ kind: "rejected" });
    else setError(result.error);
  }

  if (done?.kind === "approved") {
    return (
      <div
        className="rounded-xl border border-line bg-white p-5"
        data-testid={`verify-card-${applicant.id}`}
      >
        <p className="text-sm font-semibold text-ok">
          დელეგატი დამტკიცდა ✓ · რეფერალური ბმული აქტიურია
        </p>
        <a
          href={`/delegates/${done.slug}`}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-sm font-semibold text-brand hover:underline"
        >
          საჯარო გვერდი →
        </a>
      </div>
    );
  }
  if (done?.kind === "rejected") {
    return (
      <div
        className="rounded-xl border border-line bg-white p-5"
        data-testid={`verify-card-${applicant.id}`}
      >
        <p className="text-sm font-semibold text-danger">განაცხადი უარყოფილია.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-line bg-white p-5"
      data-testid={`verify-card-${applicant.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-[260px] flex-1 items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-sm font-bold text-ink">
            {initialsKa(applicant.firstName, applicant.lastName)}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-ink">
                {applicant.firstName} {applicant.lastName}
              </h3>
              <Pill
                status={mode === "pending" ? "pending" : "rejected"}
                label={mode === "pending" ? "მოლოდინში" : "უარყოფილი"}
              />
            </div>
            <p className="text-sm font-semibold text-muted-fg">{applicant.regionNameKa ?? "—"}</p>
            {mode === "rejected" && applicant.verifiedAt ? (
              // the decision stamp (spec §3.4): when and by whom
              <p className="mt-1 text-xs font-semibold text-muted-fg">
                უარყოფილია {formatDateKa(applicant.verifiedAt)}
                {applicant.verifiedByName ? ` · ${applicant.verifiedByName}` : null}
              </p>
            ) : null}
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-[0.72rem] font-bold uppercase tracking-wide text-muted-fg">
                  პირადი ნომერი
                </dt>
                <dd>
                  <RevealPersonalId memberId={applicant.id} reveal={reveal} />
                </dd>
              </div>
              <div>
                <dt className="text-[0.72rem] font-bold uppercase tracking-wide text-muted-fg">
                  ტელეფონი
                </dt>
                <dd className="font-semibold">{formatPhoneKa(applicant.phone)}</dd>
              </div>
              <div>
                <dt className="text-[0.72rem] font-bold uppercase tracking-wide text-muted-fg">
                  რეგისტრაცია
                </dt>
                <dd className="font-semibold">{formatDateKa(applicant.createdAt)}</dd>
              </div>
            </dl>
            {applicant.reviewNote ? (
              <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-muted-fg">
                შიდა შენიშვნა: {applicant.reviewNote}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          {mode === "pending" && !rejecting ? (
            <Button variant="danger" onClick={() => setRejecting(true)} disabled={busy}>
              უარყოფა
            </Button>
          ) : null}
          <Button variant="primary" onClick={onApprove} disabled={busy}>
            დადასტურება
          </Button>
        </div>
      </div>

      {rejecting && mode === "pending" ? (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <label className="flex min-w-[280px] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
            შიდა შენიშვნა (არასავალდებულო — განმცხადებელი ვერ ხედავს)
            <input
              type="text"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              className={adminControlClasses}
            />
          </label>
          <Button variant="danger" onClick={onReject} disabled={busy}>
            უარყოფის დადასტურება
          </Button>
          <Button variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>
            გაუქმება
          </Button>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
