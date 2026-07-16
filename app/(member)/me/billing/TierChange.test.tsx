import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
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

  it("saves a new tier, confirms, and collapses the picker", async () => {
    changeTierAction.mockResolvedValue({ ok: true, state: {} });
    render(<TierChange currentTier={10} />);
    fireEvent.click(screen.getByRole("button", { name: "შეცვლა" }));
    fireEvent.click(screen.getByRole("radio", { name: /5/ }));
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() => expect(changeTierAction).toHaveBeenCalledWith({ tier: 5 }));
    expect(await screen.findByText("საწევრო შეიცვალა ✓")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "შენახვა" })).not.toBeInTheDocument();
  });

  it("cancel restores the collapsed view without calling the action, and resets the tier", () => {
    render(<TierChange currentTier={10} />);
    fireEvent.click(screen.getByRole("button", { name: "შეცვლა" }));
    fireEvent.click(screen.getByRole("radio", { name: /20/ }));
    fireEvent.click(screen.getByRole("button", { name: "გაუქმება" }));
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(changeTierAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "შეცვლა" }));
    expect(screen.getByRole("radio", { name: /10/ })).toHaveAttribute("aria-checked", "true");
  });

  it("offers a picker for a legacy member with no tier yet, and saves the choice", async () => {
    changeTierAction.mockResolvedValue({ ok: true });
    render(<TierChange currentTier={null} />);
    expect(screen.getByTestId("current-tier")).toHaveTextContent("საწევრო ჯერ არ არის არჩეული");
    fireEvent.click(screen.getByRole("button", { name: "აირჩიე საწევრო" }));
    fireEvent.click(screen.getByRole("radio", { name: /10/ }));
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() => expect(changeTierAction).toHaveBeenCalledWith({ tier: 10 }));
    expect(await screen.findByText("საწევრო შეიცვალა ✓")).toBeInTheDocument();
  });

  it("shows the generic error and keeps the picker open (re-enabled) when the action rejects", async () => {
    // mockRejectedValueOnce (not mockRejectedValue): the persistent variant, combined
    // with this file's beforeEach(mockReset()), triggers a spurious unhandled-rejection
    // failure in this Vitest+jsdom environment even though the component's try/catch
    // genuinely handles it (root-caused via bisection — not a component bug). "Once" is
    // also the more precise simulation anyway: this test drives exactly one save() call.
    changeTierAction.mockRejectedValueOnce(new Error("boom"));
    render(<TierChange currentTier={10} />);
    fireEvent.click(screen.getByRole("button", { name: "შეცვლა" }));
    fireEvent.click(screen.getByRole("radio", { name: /20/ }));
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    expect(await screen.findByText(GENERIC_FUNNEL_ERROR)).toBeInTheDocument();
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "შენახვა" })).not.toBeDisabled();
  });
});
