import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoidPaymentButton } from "./VoidPaymentButton";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("VoidPaymentButton (spec §3.5 — void with required reason)", () => {
  it("reveals the reason field, requires ≥3 chars, then voids", async () => {
    const voidPayment = vi.fn().mockResolvedValue({ ok: true });
    render(<VoidPaymentButton paymentId={7} voidPayment={voidPayment} />);
    fireEvent.click(screen.getByRole("button", { name: "გაუქმება" }));
    const confirmButton = screen.getByRole("button", { name: "გაუქმების დადასტურება" });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/მიზეზი/), { target: { value: "შეცდომით ჩაიწერა" } });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);
    await waitFor(() => expect(voidPayment).toHaveBeenCalledWith(7, "შეცდომით ჩაიწერა"));
  });
  it("shows the action's Georgian error", async () => {
    const voidPayment = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "ეს გადახდა უკვე გაუქმებულია." });
    render(<VoidPaymentButton paymentId={7} voidPayment={voidPayment} />);
    fireEvent.click(screen.getByRole("button", { name: "გაუქმება" }));
    fireEvent.change(screen.getByLabelText(/მიზეზი/), { target: { value: "შეცდომით" } });
    fireEvent.click(screen.getByRole("button", { name: "გაუქმების დადასტურება" }));
    await waitFor(() =>
      expect(screen.getByText("ეს გადახდა უკვე გაუქმებულია.")).toBeInTheDocument(),
    );
  });
});
