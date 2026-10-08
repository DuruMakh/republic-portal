import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BOARD_MEMBERS } from "@/lib/board-members";
import * as copy from "@/lib/structure-copy";
import StructurePage from "./page";

describe("/structure", () => {
  // One render: every approved copy constant, both rule images, the section index, the CTA
  // and the board roster.
  it("renders the approved page", () => {
    const { container } = render(<StructurePage />);
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
      ...copy.BOARD_DUTIES,
      ...copy.MEMBERS_PATH_STEPS,
      ...copy.MEMBERS_RIGHTS,
    ]) {
      expect(screen.getAllByText(text).length, text).toBeGreaterThan(0);
    }
    expect(screen.getByRole("img", { name: "5-დან 4 ხმა" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "5-დან 3 ხმა" })).toBeInTheDocument();
    const index = screen.getByRole("navigation", { name: copy.STRUCTURE_TITLE });
    for (const { href, label } of copy.SECTION_INDEX) {
      expect(within(index).getByRole("link", { name: label })).toHaveAttribute("href", href);
      expect(container.querySelector(href)).not.toBeNull();
    }
    expect(screen.getByRole("link", { name: copy.CLOSING_CTA })).toHaveAttribute("href", "/join");
    // The roster is filled (owner list, 2026-10-08): one card per member, no coming-soon notice.
    const roster = screen.getByRole("region", { name: copy.ROSTER_HEADING });
    expect(within(roster).getAllByRole("article")).toHaveLength(BOARD_MEMBERS.length);
    expect(BOARD_MEMBERS.length).toBeGreaterThan(0);
    expect(screen.queryByText(copy.ROSTER_NOTICE)).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-placeholder="true"]')).toHaveLength(0);
  });
});
