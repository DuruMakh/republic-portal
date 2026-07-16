import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReferralCard } from "./ReferralCard";

describe("ReferralCard", () => {
  it("builds the link from the current origin, with copy button and QR", async () => {
    render(<ReferralCard code="AB2C3D" />);
    const url = await screen.findByTestId("referral-url");
    expect(url.textContent).toBe(`${window.location.origin}/join?ref=AB2C3D`);
    expect(screen.getByRole("button", { name: "კოპირება" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "რეფერალური ბმულის QR კოდი" }).innerHTML).toContain(
      "<svg",
    );
  });
});
