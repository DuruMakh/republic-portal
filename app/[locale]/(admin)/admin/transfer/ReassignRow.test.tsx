import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReassignRow } from "./ReassignRow";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const options = [
  { id: "d-1", name: "გიორგი მაისურაძე" },
  { id: "d-2", name: "ნინო ლომიძე" },
];

describe("ReassignRow (spec §3.6)", () => {
  it("reassigns to the selected same-region delegate", async () => {
    const reassign = vi.fn().mockResolvedValue({ ok: true });
    render(<ReassignRow memberId="m-1" options={options} reassign={reassign} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "d-2" } });
    fireEvent.click(screen.getByRole("button", { name: "გადანაწილება" }));
    await waitFor(() => expect(screen.getByText(/გადანაწილდა/)).toBeInTheDocument());
    expect(reassign).toHaveBeenCalledWith("m-1", "d-2");
  });
  it("no approved delegate in the region → prototype note + disabled action", () => {
    render(<ReassignRow memberId="m-1" options={[]} reassign={vi.fn()} />);
    expect(screen.getByText("ამ მხარეს დამტკიცებული დელეგატი არ ჰყავს")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "გადანაწილება" })).toBeDisabled();
  });
  it("surfaces errors and keeps the row usable", async () => {
    const reassign = vi.fn().mockResolvedValue({ ok: false, error: "შეცდომა" });
    render(<ReassignRow memberId="m-1" options={options} reassign={reassign} />);
    fireEvent.click(screen.getByRole("button", { name: "გადანაწილება" }));
    await waitFor(() => expect(screen.getByText("შეცდომა")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "გადანაწილება" })).toBeEnabled();
  });
});
