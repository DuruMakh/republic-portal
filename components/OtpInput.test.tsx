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
});
