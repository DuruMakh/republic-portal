"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { formatAmountGel } from "@/lib/cabinet";
import type { BulkConfirmResult, BulkPreviewResult, BulkPreviewRow, BulkStatus } from "./types";

const STATUS_LABELS: Record<BulkStatus, string> = {
  ok: "ნაპოვნია",
  no_code: "კოდი ვერ მოიძებნა",
  no_amount: "თანხა ვერ დადგინდა",
  ambiguous_amount: "გაურკვეველი თანხა",
  unknown_code: "უცნობი კოდი",
  duplicate: "დუბლიკატი",
  duplicate_line: "განმეორებული ხაზი",
  not_completed: "დაუსრულებელი რეგისტრაცია",
  bad_date: "თარიღი დიაპაზონს გარეთაა",
};

export function BulkMatch({
  preview,
  confirm,
}: {
  preview: (text: string) => Promise<BulkPreviewResult>;
  confirm: (
    rows: { referenceCode: string; amountGel: number; paidAt: string }[],
  ) => Promise<BulkConfirmResult>;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<BulkPreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const okRows = (rows ?? []).filter((r) => r.status === "ok");

  async function onPreview() {
    setBusy(true);
    setNotice(null);
    const result = await preview(text);
    setBusy(false);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.error });
      setRows(null);
      return;
    }
    setRows(result.rows);
  }

  async function onConfirm() {
    setBusy(true);
    setNotice(null);
    const result = await confirm(
      okRows.map((r) => ({
        referenceCode: r.code as string,
        amountGel: r.amountGel as number,
        paidAt: r.paidAt as string,
      })),
    );
    setBusy(false);
    if (!result.ok) {
      // the RPC's rowIndex counts the SENT payload (✓ rows only) — translate it
      // back to the row's position in the on-screen preview table
      const failedOriginalIndex =
        result.rowIndex === null ? null : (okRows[result.rowIndex]?.index ?? result.rowIndex);
      setNotice({
        kind: "error",
        text:
          failedOriginalIndex === null
            ? `ვერ ჩაიწერა — ${result.error}`
            : `ვერ ჩაიწერა — შეცდომა მე-${failedOriginalIndex + 1} რიგში: ${result.error}. არცერთი რიგი არ ჩაწერილა.`,
      });
      return;
    }
    const leftovers = (rows ?? []).filter((r) => r.status !== "ok");
    setNotice({
      kind: "ok",
      text:
        leftovers.length === 0
          ? `აღირიცხა ${result.count} გადახდა (${formatAmountGel(result.totalGel)} ₾).`
          : `აღირიცხა ${result.count} გადახდა (${formatAmountGel(result.totalGel)} ₾). დარჩენილი ${leftovers.length} რიგი აღრიცხე ერთეულად.`,
    });
    // spec §3.5: non-✓ rows STAY on screen for manual single-entry handling
    setRows(leftovers.length === 0 ? null : leftovers);
    setText("");
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
        ამონაწერის სტრიქონები (ჩასვი ბანკიდან ან Excel-იდან)
        <textarea
          value={text}
          rows={6}
          onChange={(e) => setText(e.target.value)}
          placeholder={"01.07.2026\tGR-ABC234 საწევრო\t20.00"}
          className="rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs font-normal"
        />
      </label>
      <div>
        <Button variant="dark" onClick={onPreview} disabled={busy || text.trim().length === 0}>
          გადამოწმება
        </Button>
      </div>

      {rows !== null ? (
        <>
          <DataTable
            bodyTestId="bulk-preview-body"
            head={
              <>
                <th className={tableThClass}>სტრიქონი</th>
                <th className={tableThClass}>კოდი</th>
                <th className={tableThClass}>თანხა</th>
                <th className={tableThClass}>თარიღი</th>
                <th className={tableThClass}>წევრი</th>
                <th className={tableThClass}>შედეგი</th>
              </>
            }
          >
            {rows.map((r) => (
              <tr key={r.index} className={tableRowClass}>
                <td className={`${tableCellClass} max-w-[260px] truncate font-mono text-xs`}>
                  {r.line}
                </td>
                <td className={`${tableCellClass} font-mono text-xs`}>{r.code ?? "—"}</td>
                <td className={tableCellClass}>
                  {r.amountGel === null ? "—" : formatAmountGel(r.amountGel)}
                </td>
                <td className={tableCellClass}>{r.paidAt ?? "—"}</td>
                <td className={tableCellClass}>
                  {r.memberName ?? "—"}
                  {r.months !== null ? (
                    <span className="ms-1 text-xs text-muted-fg">→ {r.months} თვე</span>
                  ) : null}
                </td>
                <td className={tableCellClass}>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.status === "ok"
                        ? "bg-ok/10 text-ok"
                        : r.status === "duplicate" || r.status === "duplicate_line"
                          ? "bg-warn/10 text-warn"
                          : "bg-danger/10 text-danger"
                    }`}
                  >
                    {STATUS_LABELS[r.status]}
                  </span>
                </td>
              </tr>
            ))}
          </DataTable>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-fg">
              {/* spec §3.5: the summary counts each kind, not just two aggregates */}
              {(Object.entries(STATUS_LABELS) as [BulkStatus, string][])
                .map(([status, label]) => ({
                  label: status === "ok" ? "ჩაიწერება" : label,
                  count: rows.filter((r) => r.status === status).length,
                }))
                .filter((s) => s.count > 0)
                .map((s) => `${s.label}: ${s.count}`)
                .join(" · ")}
            </p>
            <Button variant="primary" onClick={onConfirm} disabled={busy || okRows.length === 0}>
              დადასტურება ({okRows.length})
            </Button>
          </div>
        </>
      ) : null}

      {notice ? (
        <p className={`text-sm font-semibold ${notice.kind === "ok" ? "text-ok" : "text-danger"}`}>
          {notice.text}
        </p>
      ) : null}
    </div>
  );
}
