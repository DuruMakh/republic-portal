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

  it("marks the label as a level-2 heading by default (screen-reader landmark)", () => {
    render(<SectionRule label="Public registry" />);
    const heading = screen.getByRole("heading", { level: 2, name: "Public registry" });
    expect(heading.tagName).toBe("H2");
    // the visual label classes must stay on the heading itself
    expect(heading.className).toContain("uppercase");
  });

  it("renders the requested heading level when `as` is set", () => {
    render(<SectionRule label="Subsection" as="h3" />);
    expect(screen.getByRole("heading", { level: 3, name: "Subsection" }).tagName).toBe("H3");
  });

  it("renders a non-heading label when `as` is div (decorative escape hatch)", () => {
    render(<SectionRule label="Decorative" as="div" />);
    expect(screen.queryByRole("heading", { name: "Decorative" })).not.toBeInTheDocument();
    expect(screen.getByText("Decorative")).toBeInTheDocument();
  });
});
