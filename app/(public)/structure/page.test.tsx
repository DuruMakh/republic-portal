import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as copy from "@/lib/structure-copy";
import StructurePage, { metadata } from "./page";

describe("/structure", () => {
  it("titles the tab with the page name and the site name", () => {
    expect(metadata.title).toBe("ორგანიზაციული სტრუქტურა — ქართული რესპუბლიკა");
  });

  it("renders the title, the intro and every approved section heading", () => {
    render(<StructurePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: copy.STRUCTURE_TITLE }),
    ).toBeInTheDocument();
    expect(screen.getByText(copy.STRUCTURE_INTRO)).toBeInTheDocument();
    for (const h of [
      copy.BOARD_HEADING,
      copy.MEMBERS_HEADING,
      copy.VOTE_HEADING,
      copy.ROSTER_HEADING,
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    }
  });

  it("renders every approved sentence and list item", () => {
    render(<StructurePage />);
    for (const text of [
      copy.BOARD_LEAD,
      copy.BOARD_RULES_LABEL,
      copy.RULE_TWO_THIRDS.headline,
      copy.RULE_TWO_THIRDS.body,
      copy.RULE_MAJORITY.headline,
      copy.RULE_MAJORITY.body,
      copy.MEMBERS_LEAD,
      copy.MEMBERS_PATH_LABEL,
      copy.MEMBERS_RIGHTS_LABEL,
      copy.VOTE_LEAD,
      copy.VOTE_FOR,
      copy.VOTE_AGAINST,
      copy.ROSTER_NOTICE,
      ...copy.BOARD_DUTIES,
      ...copy.MEMBERS_PATH_STEPS,
      ...copy.MEMBERS_RIGHTS,
    ]) {
      expect(screen.getAllByText(text).length, text).toBeGreaterThan(0);
    }
  });

  it("shows 4 of 5 for the two-thirds rule and 3 of 5 for the majority rule", () => {
    render(<StructurePage />);
    expect(screen.getByRole("img", { name: "5-დან 4 ხმა" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "5-დან 3 ხმა" })).toBeInTheDocument();
  });

  it("links the section index to its anchors and the closing button to /join", () => {
    const { container } = render(<StructurePage />);
    const index = screen.getByRole("navigation", { name: copy.STRUCTURE_TITLE });
    for (const { href, label } of copy.SECTION_INDEX) {
      expect(within(index).getByRole("link", { name: label })).toHaveAttribute("href", href);
      expect(container.querySelector(href)).not.toBeNull();
    }
    expect(screen.getByRole("link", { name: copy.CLOSING_CTA })).toHaveAttribute("href", "/join");
  });

  it("launches with the coming-soon roster", () => {
    const { container } = render(<StructurePage />);
    expect(container.querySelectorAll('[data-placeholder="true"]')).toHaveLength(5);
  });
});
