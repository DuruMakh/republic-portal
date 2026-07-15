import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TierPicker } from "./TierPicker";

describe("TierPicker", () => {
  it("renders the three tiers with the current one checked", () => {
    render(<TierPicker value={10} onChange={() => undefined} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByText("თვეში")).toHaveLength(3);
  });
  it("reports tier selection", () => {
    const onChange = vi.fn();
    render(<TierPicker value={10} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole("radio")[2]!);
    expect(onChange).toHaveBeenCalledWith(20);
  });
});
