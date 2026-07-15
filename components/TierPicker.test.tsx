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
  it("roving tabindex: only the selected radio is a tab stop", () => {
    render(<TierPicker value={10} onChange={() => undefined} />);
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toHaveAttribute("tabindex", "-1");
    expect(radios[1]).toHaveAttribute("tabindex", "0");
    expect(radios[2]).toHaveAttribute("tabindex", "-1");
  });
  it("ArrowRight selects the next tier and moves focus to it", () => {
    const onChange = vi.fn();
    render(<TierPicker value={10} onChange={onChange} />);
    const radios = screen.getAllByRole("radio");
    fireEvent.keyDown(radios[1]!, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(20);
    expect(radios[2]).toHaveFocus();
  });
  it("ArrowRight wraps 20 -> 5", () => {
    const onChange = vi.fn();
    render(<TierPicker value={20} onChange={onChange} />);
    const radios = screen.getAllByRole("radio");
    fireEvent.keyDown(radios[2]!, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(5);
    expect(radios[0]).toHaveFocus();
  });
  it("ArrowLeft selects the previous tier, wrapping 5 -> 20", () => {
    const onChange = vi.fn();
    render(<TierPicker value={5} onChange={onChange} />);
    fireEvent.keyDown(screen.getAllByRole("radio")[0]!, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith(20);
  });
  it("ArrowDown and ArrowUp mirror ArrowRight and ArrowLeft", () => {
    const onChange = vi.fn();
    render(<TierPicker value={10} onChange={onChange} />);
    const radios = screen.getAllByRole("radio");
    fireEvent.keyDown(radios[1]!, { key: "ArrowDown" });
    expect(onChange).toHaveBeenLastCalledWith(20);
    fireEvent.keyDown(radios[1]!, { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith(5);
  });
});
