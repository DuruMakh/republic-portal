import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { OtpInput } from "./OtpInput";

function Harness() {
  const [value, setValue] = useState("");
  return (
    <>
      <OtpInput value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe("OtpInput", () => {
  it("renders six numeric boxes", () => {
    render(<OtpInput value="" onChange={() => undefined} />);
    for (let i = 0; i < 6; i++) expect(screen.getByTestId(`otp-${i}`)).toBeInTheDocument();
  });
  it("collects typed digits into the value and moves focus forward", () => {
    render(<Harness />);
    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "1" } });
    fireEvent.change(screen.getByTestId("otp-1"), { target: { value: "2" } });
    expect(screen.getByTestId("value").textContent).toBe("12");
    expect(screen.getByTestId("otp-2")).toHaveFocus();
  });
  it("distributes a pasted code across the boxes", () => {
    render(<Harness />);
    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "123456" } });
    expect(screen.getByTestId("value").textContent).toBe("123456");
  });
  it("ignores non-digits", () => {
    render(<Harness />);
    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "a" } });
    expect(screen.getByTestId("value").textContent).toBe("");
  });
  it("associates the error with every box via aria-invalid and aria-describedby", () => {
    render(<OtpInput value="" onChange={() => undefined} error="კოდი არასწორია" />);
    expect(screen.getByRole("alert")).toHaveTextContent("კოდი არასწორია");
    for (let i = 0; i < 6; i++) {
      const box = screen.getByTestId(`otp-${i}`);
      expect(box).toHaveAttribute("aria-invalid", "true");
      const describedBy = box.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      const description = document.getElementById(describedBy!);
      expect(description).toHaveTextContent("კოდი არასწორია");
    }
  });
  it("carries no error attributes when there is no error", () => {
    render(<OtpInput value="" onChange={() => undefined} />);
    const box = screen.getByTestId("otp-0");
    expect(box).not.toHaveAttribute("aria-invalid");
    expect(box).not.toHaveAttribute("aria-describedby");
  });
  it("backspace in an empty box moves focus to the previous box", () => {
    render(<Harness />);
    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "1" } });
    expect(screen.getByTestId("otp-1")).toHaveFocus();
    fireEvent.keyDown(screen.getByTestId("otp-1"), { key: "Backspace" });
    expect(screen.getByTestId("otp-0")).toHaveFocus();
  });
});

it("focuses the first digit on a new submission error without taking focus on mount", () => {
  const { rerender } = render(<OtpInput value="123456" onChange={() => undefined} />);
  expect(screen.getByTestId("otp-0")).not.toHaveFocus();
  rerender(<OtpInput value="123456" onChange={() => undefined} error="კოდი არასწორია" />);
  expect(screen.getByTestId("otp-0")).toHaveFocus();
});

it("focuses on repeated error attempts while leaving mounting and value changes alone", () => {
  const { rerender } = render(
    <OtpInput
      value="1"
      onChange={() => undefined}
      error="შეიყვანე 6-ნიშნა კოდი"
      errorAttempt={0}
    />,
  );
  const firstDigit = screen.getByTestId("otp-0");
  const thirdDigit = screen.getByTestId("otp-2");
  expect(firstDigit).not.toHaveFocus();
  thirdDigit.focus();
  rerender(
    <OtpInput
      value="12"
      onChange={() => undefined}
      error="შეიყვანე 6-ნიშნა კოდი"
      errorAttempt={0}
    />,
  );
  expect(thirdDigit).toHaveFocus();
  rerender(
    <OtpInput
      value="12"
      onChange={() => undefined}
      error="შეიყვანე 6-ნიშნა კოდი"
      errorAttempt={1}
    />,
  );
  expect(firstDigit).toHaveFocus();
  thirdDigit.focus();
  rerender(
    <OtpInput
      value="12"
      onChange={() => undefined}
      error="შეიყვანე 6-ნიშნა კოდი"
      errorAttempt={2}
    />,
  );
  expect(firstDigit).toHaveFocus();
});
