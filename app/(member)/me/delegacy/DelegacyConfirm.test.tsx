import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const requestDelegacyAction = vi.fn();
vi.mock("./actions", () => ({
  requestDelegacyAction: (...a: unknown[]) => requestDelegacyAction(...a),
}));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { DelegacyConfirm } from "./DelegacyConfirm";

describe("DelegacyConfirm", () => {
  it("submits and refreshes on success", async () => {
    requestDelegacyAction.mockResolvedValue({ ok: true });
    render(<DelegacyConfirm />);
    fireEvent.click(screen.getByRole("button", { name: "მოთხოვნის გაგზავნა" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
  it("shows the Georgian error and re-enables on failure", async () => {
    requestDelegacyAction.mockResolvedValue({
      ok: false,
      error: "დელეგატობის მოთხოვნა უკვე დაფიქსირებულია.",
    });
    render(<DelegacyConfirm />);
    const btn = screen.getByRole("button", { name: "მოთხოვნის გაგზავნა" });
    fireEvent.click(btn);
    await waitFor(() =>
      expect(screen.getByText("დელეგატობის მოთხოვნა უკვე დაფიქსირებულია.")).toBeVisible(),
    );
    expect(btn).toBeEnabled();
  });
  it("never strands the button on a thrown action", async () => {
    requestDelegacyAction.mockRejectedValue(new Error("network"));
    render(<DelegacyConfirm />);
    const btn = screen.getByRole("button", { name: "მოთხოვნის გაგზავნა" });
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toBeEnabled());
    expect(screen.getByText("რაღაც შეცდომა მოხდა — სცადე თავიდან.")).toBeVisible();
  });
});
