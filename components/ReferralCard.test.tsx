import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReferralCard } from "./ReferralCard";

describe("ReferralCard", () => {
  it("builds the link from the current origin, with copy button and QR", async () => {
    render(<ReferralCard code="AB2C3D" count={0} />);
    const url = await screen.findByTestId("referral-url");
    expect(url.textContent).toBe(`${window.location.origin}/join?ref=AB2C3D`);
    expect(screen.getByRole("button", { name: "კოპირება" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "რეფერალური ბმულის QR კოდი" }).innerHTML).toContain(
      "<svg",
    );
  });

  it("shows how many people registered through the link (owner fix #12)", () => {
    render(<ReferralCard code="M-ABC234" count={7} />);
    expect(screen.getByTestId("referral-count")).toHaveTextContent("7");
  });
});
