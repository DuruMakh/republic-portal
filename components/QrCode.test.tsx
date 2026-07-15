import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QrCode } from "./QrCode";

describe("QrCode", () => {
  it("renders an inline SVG for the value with an accessible label", () => {
    render(<QrCode value="https://example.org/join?ref=D00101" label="რეფერალური QR კოდი" />);
    const figure = screen.getByRole("img", { name: "რეფერალური QR კოდი" });
    expect(figure.innerHTML).toContain("<svg");
  });
});
