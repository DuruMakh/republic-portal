import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { mtavruli } from "@/lib/mtavruli";
import { UnitySelectField } from "./UnitySelectField";

describe("UnitySelectField", () => {
  it("names the select in ordinary letters and shows the label in capitals", () => {
    render(
      <UnitySelectField label="მხარე" value="2" onChange={() => {}}>
        <option value="1">თბილისი</option>
        <option value="2">აჭარა</option>
      </UnitySelectField>,
    );
    expect(screen.getByRole("combobox", { name: "მხარე" })).toHaveValue("2");
    expect(screen.getByText(mtavruli("მხარე"))).toHaveAttribute("aria-hidden", "true");
  });

  it("passes changes through", () => {
    const onChange = vi.fn();
    render(
      <UnitySelectField label="მხარე" value="1" onChange={onChange}>
        <option value="1">თბილისი</option>
        <option value="2">აჭარა</option>
      </UnitySelectField>,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "მხარე" }), { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("marks an error and ties the message to the select", () => {
    render(
      <UnitySelectField label="მხარე" error="აირჩიე მხარე" defaultValue="">
        <option value="">—</option>
      </UnitySelectField>,
    );
    const select = screen.getByRole("combobox", { name: "მხარე" });
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("აირჩიე მხარე");
  });
});
