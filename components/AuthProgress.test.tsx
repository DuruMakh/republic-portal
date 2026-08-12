import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthProgress } from "./AuthProgress";

describe("AuthProgress", () => {
  it("marks only the phone step as current after Google succeeds", () => {
    render(<AuthProgress currentStep="phone" />);

    expect(screen.getByRole("list", { name: "რეგისტრაციის ნაბიჯები" })).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("ტელეფონი").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("კაბინეტი")).toBeInTheDocument();
    expect(
      screen.getAllByRole("listitem").filter((item) => item.hasAttribute("aria-current")),
    ).toHaveLength(1);
  });

  it("marks Google as current before registration details are available", () => {
    render(<AuthProgress currentStep="google" />);

    expect(screen.getByText("Google").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
  });
});
