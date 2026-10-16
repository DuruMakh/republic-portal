import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnityPageHead, UnitySectionLabel } from "./UnityPageHead";

describe("UnityPageHead", () => {
  it("shows the kicker, the page heading and the intro", () => {
    render(<UnityPageHead kicker="ქართული რესპუბლიკა" title="სიახლეები" intro="მოკლე შესავალი." />);
    expect(screen.getByRole("heading", { level: 1, name: "სიახლეები" })).toHaveAttribute(
      "id",
      "page-title",
    );
    expect(screen.getByText("ᲥᲐᲠᲗᲣᲚᲘ ᲠᲔᲡᲞᲣᲑᲚᲘᲙᲐ")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("მოკლე შესავალი.")).toBeInTheDocument();
  });

  it("leaves out the intro when there is none", () => {
    const { container } = render(<UnityPageHead kicker="წესები" title="წესები" />);
    expect(container.querySelector("p")).toBeNull();
  });
});

describe("UnitySectionLabel", () => {
  it("is a level-two heading in ordinary letters for screen readers", () => {
    render(<UnitySectionLabel>სიახლეები</UnitySectionLabel>);
    expect(screen.getByRole("heading", { level: 2, name: "სიახლეები" })).toBeInTheDocument();
  });
});
