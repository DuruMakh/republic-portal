import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionRule } from "./SectionRule";

describe("SectionRule", () => {
  it("renders the label text and the action node", () => {
    render(<SectionRule label="Recent activity" action={<a href="/all">See all</a>} />);
    expect(screen.getByText("Recent activity")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute("href", "/all");
  });

  it("renders the label alone when no action is given", () => {
    render(<SectionRule label="Just a label" />);
    expect(screen.getByText("Just a label")).toBeInTheDocument();
  });

  it("puts the label and rule classes on the row", () => {
    const { container } = render(<SectionRule label="Row" />);
    const row = container.firstElementChild;
    expect(row?.className).toContain("border-b-2");
    expect(row?.className).toContain("border-ink");
    expect(screen.getByText("Row").className).toContain("uppercase");
  });
});
