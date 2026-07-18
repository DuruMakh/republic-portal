import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecordPayment } from "./RecordPayment";

const candidate = {
  id: "m-1",
  name: "ნინო ბერიძე",
  regionNameKa: "იმერეთი",
  tier: 20,
  status: "profile_completed" as const,
  referenceCode: "GR-ABC234",
};

describe("RecordPayment (spec §3.5 — single entry)", () => {
  it("looks up, picks a member, previews months live, records", async () => {
    const lookup = vi.fn().mockResolvedValue({ ok: true, candidates: [candidate] });
    const record = vi.fn().mockResolvedValue({ ok: true, months: 3, newStatus: "active_member" });
    render(<RecordPayment lookup={lookup} record={record} />);

    fireEvent.change(screen.getByLabelText(/წევრის ძებნა/), { target: { value: "GR-ABC234" } });
    fireEvent.click(screen.getByRole("button", { name: "ძებნა" }));
    await waitFor(() => expect(screen.getByText(/ნინო ბერიძე/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /ნინო ბერიძე/ }));

    const amount = screen.getByLabelText(/თანხა/);
    fireEvent.change(amount, { target: { value: "60" } });
    expect(screen.getByText(/→ 3 თვე/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "აღრიცხვა" }));
    await waitFor(() => expect(screen.getByText(/აღირიცხა — 3 თვე/)).toBeInTheDocument());
    expect(screen.getByText(/წევრი ახლა აქტიურია/)).toBeInTheDocument();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: "m-1", amountGel: 60 }),
    );
  });

  it("no candidates → honest empty result", async () => {
    const lookup = vi.fn().mockResolvedValue({ ok: true, candidates: [] });
    render(<RecordPayment lookup={lookup} record={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/წევრის ძებნა/), { target: { value: "არავინ" } });
    fireEvent.click(screen.getByRole("button", { name: "ძებნა" }));
    await waitFor(() => expect(screen.getByText(/ვერ მოიძებნა/)).toBeInTheDocument());
  });

  it("surfaces record errors in Georgian and keeps the form", async () => {
    const lookup = vi.fn().mockResolvedValue({ ok: true, candidates: [candidate] });
    const record = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "ამ საბანკო რეფერენსით გადახდა უკვე აღრიცხულია." });
    render(<RecordPayment lookup={lookup} record={record} />);
    fireEvent.change(screen.getByLabelText(/წევრის ძებნა/), { target: { value: "GR-ABC234" } });
    fireEvent.click(screen.getByRole("button", { name: "ძებნა" }));
    await waitFor(() => expect(screen.getByText(/ნინო ბერიძე/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /ნინო ბერიძე/ }));
    fireEvent.change(screen.getByLabelText(/თანხა/), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "აღრიცხვა" }));
    await waitFor(() => expect(screen.getByText(/უკვე აღრიცხულია/)).toBeInTheDocument());
    expect(screen.getByLabelText(/თანხა/)).toBeInTheDocument();
  });
});
