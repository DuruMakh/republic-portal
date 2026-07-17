import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BulkMatch } from "./BulkMatch";
import type { BulkPreviewRow } from "./types";

// one row per BulkStatus — spec §3.5's component test covers EVERY pill
const rows: BulkPreviewRow[] = [
  {
    index: 0,
    line: "GR-ABC234 20.00",
    code: "GR-ABC234",
    amountGel: 20,
    paidAt: "2026-07-01",
    status: "ok",
    memberName: "ნინო ბერიძე",
    months: 1,
  },
  {
    index: 1,
    line: "GR-ZZZZZ9 20.00",
    code: "GR-ZZZZZ9",
    amountGel: 20,
    paidAt: "2026-07-01",
    status: "unknown_code",
    memberName: null,
    months: null,
  },
  {
    index: 2,
    line: "უცნობი 20.00",
    code: null,
    amountGel: 20,
    paidAt: "2026-07-01",
    status: "no_code",
    memberName: null,
    months: null,
  },
  {
    index: 3,
    line: "GR-ABC234 20.00 დუბლი",
    code: "GR-ABC234",
    amountGel: 20,
    paidAt: "2026-07-01",
    status: "duplicate",
    memberName: "ნინო ბერიძე",
    months: null,
  },
  {
    index: 4,
    line: "GR-KMP234 20 30",
    code: "GR-KMP234",
    amountGel: null,
    paidAt: "2026-07-01",
    status: "ambiguous_amount",
    memberName: null,
    months: null,
  },
  {
    index: 5,
    line: "GR-KMP234 საწევრო",
    code: "GR-KMP234",
    amountGel: null,
    paidAt: "2026-07-01",
    status: "no_amount",
    memberName: null,
    months: null,
  },
  {
    index: 6,
    line: "GR-ABC234 20.00",
    code: "GR-ABC234",
    amountGel: 20,
    paidAt: "2026-07-01",
    status: "duplicate_line",
    memberName: null,
    months: null,
  },
  {
    index: 7,
    line: "GR-DDD234 20.00",
    code: "GR-DDD234",
    amountGel: 20,
    paidAt: "2026-07-01",
    status: "not_completed",
    memberName: "გია რაზმაძე",
    months: null,
  },
  {
    index: 8,
    line: "GR-ABC234 20.00 15.03.2025",
    code: "GR-ABC234",
    amountGel: 20,
    paidAt: "2025-03-15",
    status: "bad_date",
    memberName: null,
    months: null,
  },
];

describe("BulkMatch (spec §3.5 — classify, then confirm only ✓)", () => {
  it("previews rows with status pills and a summary; confirms only the ✓ rows", async () => {
    const preview = vi.fn().mockResolvedValue({ ok: true, rows });
    const confirm = vi.fn().mockResolvedValue({ ok: true, count: 1, totalGel: 20 });
    render(<BulkMatch preview={preview} confirm={confirm} />);

    fireEvent.change(screen.getByLabelText(/ამონაწერის სტრიქონები/), {
      target: { value: "რამე ტექსტი" },
    });
    fireEvent.click(screen.getByRole("button", { name: "გადამოწმება" }));
    await waitFor(() => expect(screen.getByText("ნაპოვნია")).toBeInTheDocument());
    expect(screen.getByText("უცნობი კოდი")).toBeInTheDocument();
    expect(screen.getByText("კოდი ვერ მოიძებნა")).toBeInTheDocument();
    expect(screen.getByText("დუბლიკატი")).toBeInTheDocument();
    expect(screen.getByText("გაურკვეველი თანხა")).toBeInTheDocument();
    expect(screen.getByText("თანხა ვერ დადგინდა")).toBeInTheDocument();
    expect(screen.getByText("განმეორებული ხაზი")).toBeInTheDocument();
    expect(screen.getByText("დაუსრულებელი რეგისტრაცია")).toBeInTheDocument();
    expect(screen.getByText("თარიღი დიაპაზონს გარეთაა")).toBeInTheDocument();
    expect(screen.getByText(/ჩაიწერება: 1/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /დადასტურება/ }));
    await waitFor(() => expect(screen.getByText(/აღირიცხა 1 გადახდა/)).toBeInTheDocument());
    expect(confirm).toHaveBeenCalledWith([
      { referenceCode: "GR-ABC234", amountGel: 20, paidAt: "2026-07-01" },
    ]);
    // spec §3.5: non-✓ rows STAY on screen for manual handling; the ✓ row is gone
    expect(screen.getByText("უცნობი კოდი")).toBeInTheDocument();
    expect(screen.queryByText("ნაპოვნია")).not.toBeInTheDocument();
    expect(screen.getByText(/დარჩენილი 8 რიგი აღრიცხე ერთეულად/)).toBeInTheDocument();
  });

  it("zero ✓ rows disables the confirm button", async () => {
    const preview = vi.fn().mockResolvedValue({ ok: true, rows: [rows[1]!] });
    render(<BulkMatch preview={preview} confirm={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/ამონაწერის სტრიქონები/), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "გადამოწმება" }));
    await waitFor(() => expect(screen.getByText("უცნობი კოდი")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /დადასტურება/ })).toBeDisabled();
  });

  it("a failed batch surfaces the error against the preview", async () => {
    const preview = vi.fn().mockResolvedValue({ ok: true, rows: [rows[0]!] });
    const confirm = vi.fn().mockResolvedValue({ ok: false, error: "უცნობი კოდი", rowIndex: 0 });
    render(<BulkMatch preview={preview} confirm={confirm} />);
    fireEvent.change(screen.getByLabelText(/ამონაწერის სტრიქონები/), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "გადამოწმება" }));
    await waitFor(() => expect(screen.getByText("ნაპოვნია")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /დადასტურება/ }));
    await waitFor(() =>
      expect(screen.getByText(/ვერ ჩაიწერა — შეცდომა მე-1 რიგში/)).toBeInTheDocument(),
    );
  });
});
