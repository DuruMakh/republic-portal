import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Select, SelectField } from "./Select";

describe("Select", () => {
  it("renders a native select with options and a decorative chevron", () => {
    const { container } = render(
      <Select aria-label="მხარე" defaultValue="">
        <option value="">ყველა მხარე</option>
        <option value="1">თბილისი</option>
      </Select>,
    );
    const select = screen.getByRole("combobox", { name: "მხარე" });
    expect(select.className).toContain("appearance-none");
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent("▾");
  });

  it("admin variant uses the dense control classes", () => {
    render(
      <Select variant="admin" aria-label="მხარე">
        <option>ყველა მხარე</option>
      </Select>,
    );
    expect(screen.getByRole("combobox").className).toContain("text-[0.84rem]");
  });
});

describe("SelectField", () => {
  it("associates the label and renders the error with aria-invalid", () => {
    render(
      <SelectField label="მხარე" error="აირჩიე მხარე" defaultValue="">
        <option value="">აირჩიე მხარე</option>
      </SelectField>,
    );
    const select = screen.getByLabelText("მხარე");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("აირჩიე მხარე", { selector: "p" })).toBeInTheDocument();
  });
});
