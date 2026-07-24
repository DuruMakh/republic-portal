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
  it("shows the error text", () => {
    render(<OtpInput value="" onChange={() => undefined} error="კოდი არასწორია" />);
    expect(screen.getByText("კოდი არასწორია")).toBeInTheDocument();
  });
  it("associates the error with every box via aria-invalid and aria-describedby", () => {
    render(<OtpInput value="" onChange={() => undefined} error="კოდი არასწორია" />);
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
  it("cells contain font-serif and border-b", () => {
    render(<OtpInput value="" onChange={() => undefined} />);
    for (let i = 0; i < 6; i++) {
      const cell = screen.getByTestId(`otp-${i}`);
      expect(cell.className).toContain("font-serif");
      expect(cell.className).toContain("border-b");
    }
  });
});
