import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReferralCard } from "./ReferralCard";

describe("ReferralCard", () => {
  it("builds the link from the current origin, with copy button and QR", async () => {
    render(<ReferralCard code="AB2C3D" supporters={0} members={0} />);
    const url = await screen.findByTestId("referral-url");
    expect(url.textContent).toBe(`${window.location.origin}/join?ref=AB2C3D`);
    expect(screen.getByRole("button", { name: "კოპირება" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "რეფერალური ბმულის QR კოდი" }).innerHTML).toContain(
      "<svg",
    );
  });

  it("counts supporters and members apart (ADR-039)", () => {
    render(<ReferralCard code="M-ABC234" supporters={7} members={1234} />);
    expect(screen.getByTestId("referral-supporters")).toHaveTextContent("7");
    expect(screen.getByTestId("referral-members")).toHaveTextContent("1 234");
    expect(screen.getByText("მხარდამჭერი")).toBeInTheDocument();
    expect(screen.getByText("წევრი")).toBeInTheDocument();
  });

  it("shows 0 for a figure the database did not send", () => {
    render(
      <ReferralCard
        code="M-ABC234"
        supporters={undefined as unknown as number}
        members={undefined as unknown as number}
      />,
    );
    expect(screen.getByTestId("referral-supporters")).toHaveTextContent("0");
    expect(screen.getByTestId("referral-members")).toHaveTextContent("0");
  });

  it("shows the team-note sentence by default (delegate surface)", () => {
    render(<ReferralCard code="AB2C3D" supporters={3} members={0} />);
    expect(screen.getByTestId("referral-team-note")).toBeInTheDocument();
  });

  it("hides the team-note sentence when teamNote is false (fix-list round 2, Fix 3 — a member's link binds no team)", () => {
    render(<ReferralCard code="M-ABC234" supporters={3} members={0} teamNote={false} />);
    expect(screen.queryByTestId("referral-team-note")).not.toBeInTheDocument();
  });
});
