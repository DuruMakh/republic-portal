import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TierChange } from "./TierChange";

const changeTierAction = vi.fn();
vi.mock("../actions", () => ({
  changeTierAction: (input: unknown) => changeTierAction(input),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

beforeEach(() => changeTierAction.mockReset());

describe("TierChange", () => {
  it("shows the current tier and reveals the picker on შეცვლა", () => {
    render(<TierChange currentTier={10} />);
    expect(screen.getByTestId("current-tier")).toHaveTextContent("10 ₾");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "შეცვლა" }));
    expect(screen.getByRole("radiogroup", { name: "ყოველთვიური საწევრო" })).toBeInTheDocument();
  });

  it("saves a new tier and confirms; cancel restores the collapsed view", async () => {
    changeTierAction.mockResolvedValue({ ok: true, state: {} });
    render(<TierChange currentTier={10} />);
    fireEvent.click(screen.getByRole("button", { name: "შეცვლა" }));
    fireEvent.click(screen.getByRole("radio", { name: /5/ }));
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() => expect(changeTierAction).toHaveBeenCalledWith({ tier: 5 }));
    expect(await screen.findByText("საწევრო შეიცვალა ✓")).toBeInTheDocument();
  });
});
