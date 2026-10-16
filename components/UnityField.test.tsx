import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnityCheckboxField, UnityField, UnityTextareaField } from "./UnityField";

describe("UnityField", () => {
  it("shows the label in Mtavruli but names the input in ordinary letters", () => {
    render(<UnityField label="ელ-ფოსტა" hint="(არასავალდებულო)" name="email" />);
    expect(screen.getByRole("textbox", { name: "ელ-ფოსტა (არასავალდებულო)" })).toHaveAttribute(
      "name",
      "email",
    );
    expect(screen.getByText("ᲔᲚ-ᲤᲝᲡᲢᲐ")).toHaveAttribute("aria-hidden", "true");
  });

  it("marks an error invalid and describes the input with it", () => {
    render(<UnityField label="სახელი" error="შეავსე სახელი" />);
    const input = screen.getByRole("textbox", { name: "სახელი" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("შეავსე სახელი");
  });

  it("leaves a valid input unmarked", () => {
    render(<UnityField label="სახელი" />);
    const input = screen.getByRole("textbox", { name: "სახელი" });
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });
});

describe("UnityTextareaField", () => {
  it("renders a labelled textarea with its error and footer", () => {
    render(
      <UnityTextareaField label="შეტყობინება" error="ცარიელია" footer={<span>0 / 2000</span>} />,
    );
    const box = screen.getByRole("textbox", { name: "შეტყობინება" });
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
