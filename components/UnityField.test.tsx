import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnityCheckboxField, UnityField, UnityTextareaField } from "./UnityField";

describe("UnityField", () => {
  it("labels the input with the Mtavruli label and the hint", () => {
    render(<UnityField label="ელ-ფოსტა" hint="(არასავალდებულო)" name="email" />);
    expect(screen.getByLabelText("ᲔᲚ-ᲤᲝᲡᲢᲐ (არასავალდებულო)")).toHaveAttribute("name", "email");
  });

  it("marks an error invalid and describes the input with it", () => {
    render(<UnityField label="სახელი" error="შეავსე სახელი" />);
    const input = screen.getByLabelText("ᲡᲐᲮᲔᲚᲘ");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("შეავსე სახელი");
  });

  it("leaves a valid input unmarked", () => {
    render(<UnityField label="სახელი" />);
    const input = screen.getByLabelText("ᲡᲐᲮᲔᲚᲘ");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });
});

describe("UnityTextareaField", () => {
  it("renders a labelled textarea with its error and footer", () => {
    render(
      <UnityTextareaField label="შეტყობინება" error="ცარიელია" footer={<span>0 / 2000</span>} />,
    );
    const box = screen.getByLabelText("ᲨᲔᲢᲧᲝᲑᲘᲜᲔᲑᲐ");
    expect(box.tagName).toBe("TEXTAREA");
    expect(box).toHaveAccessibleDescription("ცარიელია");
    expect(screen.getByText("0 / 2000")).toBeInTheDocument();
  });
});

describe("UnityCheckboxField", () => {
  it("is one checkbox named by its whole sentence", () => {
    const onChange = vi.fn();
    render(<UnityCheckboxField label="ვეთანხმები" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "ვეთანხმები" }));
    expect(onChange).toHaveBeenCalled();
  });
});
