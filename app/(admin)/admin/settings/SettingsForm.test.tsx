import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsForm } from "./SettingsForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("SettingsForm (spec §3.9)", () => {
  it("prefills, explains in a plain sentence, saves and confirms the recompute", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    render(<SettingsForm initialGraceDays={30} save={save} />);
    const input = screen.getByLabelText(/დამატებითი დღეები/);
    expect(input).toHaveValue(30);
    // spec §3.9 bolds only „N დღე", so „კიდევ N დღე" spans the <strong> boundary —
    // assert on the sentence paragraph's full textContent, not one text node.
    expect(screen.getByText(/წევრი აქტიურია/)).toHaveTextContent("კიდევ 30 დღე");
    // and the emphasis wraps ONLY „N დღე" — „კიდევ" must stay unbolded (spec §3.9).
    expect(screen.getByText("30 დღე").tagName).toBe("STRONG");
    fireEvent.change(input, { target: { value: "45" } });
    expect(screen.getByText(/წევრი აქტიურია/)).toHaveTextContent("კიდევ 45 დღე");
    // the live example recomputes: 31 July + 45 days = 14 September
    expect(screen.getByText(/14\.09\.2026-მდე/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() =>
      expect(screen.getByText(/შენახულია ✓ — სტატუსები გადაითვალა/)).toBeInTheDocument(),
    );
    expect(save).toHaveBeenCalledWith(45);
  });
  it("blocks out-of-range values client-side", async () => {
    const save = vi.fn();
    render(<SettingsForm initialGraceDays={30} save={save} />);
    const input = screen.getByLabelText(/დამატებითი დღეები/);
    fireEvent.change(input, { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() => expect(screen.getByText(/0-დან 365-მდე/)).toBeInTheDocument());
    expect(save).not.toHaveBeenCalled();
  });
});
