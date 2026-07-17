import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GrantRoleForm } from "./GrantRoleForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("GrantRoleForm (spec §3.7)", () => {
  it("finds a member by phone, grants the chosen role", async () => {
    const find = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        candidate: { id: "u-1", name: "ნინო ბერიძე", phone: "+995509000009" },
      });
    const grant = vi.fn().mockResolvedValue({ ok: true });
    render(<GrantRoleForm find={find} grant={grant} />);
    fireEvent.change(screen.getByLabelText(/ტელეფონი/), { target: { value: "509000009" } });
    fireEvent.click(screen.getByRole("button", { name: "მოძებნა" }));
    await waitFor(() => expect(screen.getByText(/ნინო ბერიძე/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/როლი/), { target: { value: "finance" } });
    fireEvent.click(screen.getByRole("button", { name: "მინიჭება" }));
    await waitFor(() => expect(screen.getByText(/როლი მიენიჭა/)).toBeInTheDocument());
    expect(grant).toHaveBeenCalledWith("u-1", "finance");
  });
  it("member not found → honest notice", async () => {
    const find = vi.fn().mockResolvedValue({ ok: true, candidate: null });
    render(<GrantRoleForm find={find} grant={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/ტელეფონი/), { target: { value: "500000000" } });
    fireEvent.click(screen.getByRole("button", { name: "მოძებნა" }));
    await waitFor(() => expect(screen.getByText(/წევრი ვერ მოიძებნა/)).toBeInTheDocument());
  });
});
