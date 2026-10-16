import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mtavruli } from "@/lib/mtavruli";
import * as copy from "@/lib/structure-copy";
import StructurePage from "./page";

describe("/structure", () => {
  // One render: the hero, the flow strip, every approved copy constant, both rule cards, the
  // general vote with its 1921 aside, the coming-soon roster and the closing band.
  it("renders the „ერთობა“ page", () => {
    const { container } = render(<StructurePage />);

    // Hero: kicker, two-line headline with the red second line, lede, the council ring.
    expect(screen.getByText(mtavruli(copy.STRUCTURE_NAV_LABEL))).toBeInTheDocument();
    const h1 = screen.getByRole("heading", { level: 1, name: copy.STRUCTURE_TITLE });
    expect(h1.querySelector(".text-brand")).toHaveTextContent("სტრუქტურა");
    expect(screen.getByText(copy.STRUCTURE_INTRO)).toBeInTheDocument();
    expect(screen.getByText(copy.boardSizeLabel(5))).toBeInTheDocument();

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
      copy.RULE_TWO_THIRDS.body,
      copy.RULE_MAJORITY.body,
      copy.MEMBERS_LEAD,
      copy.VOTE_LEAD,
      copy.VOTE_FOR,
      copy.VOTE_AGAINST,
      copy.ROSTER_NOTICE,
      copy.DESIGN_ONLY_COPY.rulesHint,
      ...copy.BOARD_DUTIES,
      ...copy.MEMBERS_PATH_STEPS,
      ...copy.MEMBERS_RIGHTS,
    ]) {
      expect(screen.getAllByText(text).length, text).toBeGreaterThan(0);
    }
    // Small labels and card titles are drawn in Georgian capitals (components/Caps.tsx).
    for (const label of [
      copy.BOARD_DUTIES_LABEL,
      copy.BOARD_RULES_LABEL,
      copy.MEMBERS_PATH_LABEL,
      copy.MEMBERS_RIGHTS_LABEL,
      copy.RULE_TWO_THIRDS.headline,
      copy.RULE_MAJORITY.headline,
      copy.DESIGN_ONLY_COPY.historyLabel,
    ]) {
      expect(screen.getAllByText(mtavruli(label)).length, label).toBeGreaterThan(0);
    }

    // The rule cards start at the threshold: 4 of 5 and 3 of 5, both passing.
    expect(screen.getByRole("group", { name: "5-დან 4 ხმა" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "5-დან 3 ხმა" })).toBeInTheDocument();
    expect(screen.getAllByText(copy.DESIGN_ONLY_COPY.decisionPasses)).toHaveLength(2);

    // textContent, not getByText: the matcher would fold the no-break spaces in 5 000.
    expect(
      screen.getByRole("complementary", { name: copy.DESIGN_ONLY_COPY.historyLabel }).textContent,
    ).toContain(copy.DESIGN_ONLY_COPY.historyText);
    expect(
      screen.getByRole("img", { name: copy.DESIGN_ONLY_COPY.historyImageAlt }),
    ).toHaveAttribute("src", "/unity/doc-constitution-cover.jpg");

    // The roster is still empty, so it shows five silhouettes, never the design's [placeholders].
    expect(container.querySelectorAll('[data-placeholder="true"]')).toHaveLength(5);
    expect(container.textContent).not.toMatch(/\[/);

    // Closing band.
    expect(screen.getByRole("heading", { level: 2, name: "ერთად შეგვიძლია." })).toBeInTheDocument();
  });

  it("links the flow cards to their sections, in the design's order", () => {
    const { container } = render(<StructurePage />);
    const flow = screen.getByRole("navigation", { name: copy.STRUCTURE_TITLE });
    const links = within(flow).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["#members", "#board", "#vote"]);
    for (const { href, label } of copy.SECTION_INDEX) {
      expect(within(flow).getByRole("link", { name: label })).toHaveAttribute("href", href);
      expect(container.querySelector(href)).not.toBeNull();
    }
  });

  it("sends every join button to /join and shows no ranking link", () => {
    const { container } = render(<StructurePage />);
    const join = screen.getAllByRole("link", { name: /შემოგვიერთდი/ });
    expect(join.length).toBeGreaterThan(0);
    join.forEach((a) => expect(a).toHaveAttribute("href", "/join"));
    expect(container.querySelector('a[href="/leaderboard"]')).toBeNull();
  });

  it("lets the reader toggle the pebbles to see when a decision passes", () => {
    render(<StructurePage />);
    const twoThirds = screen.getByRole("group", { name: "5-დან 4 ხმა" });
    const pebbles = within(twoThirds).getAllByRole("button");
    expect(pebbles).toHaveLength(5);
    const [first, , , fourth, fifth] = pebbles as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    expect(fourth).toHaveAttribute("aria-pressed", "true");
    expect(fifth).toHaveAttribute("aria-pressed", "false");
    expect(first).toHaveAccessibleName(copy.boardMemberLabel(1));

    fireEvent.click(fourth);
    expect(fourth).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(copy.DESIGN_ONLY_COPY.decisionFails)).toBeInTheDocument();
    // The count lives next to the row: 3 of 5 now on this card, 3 of 5 on the majority card.
    expect(screen.getAllByText("5-დან 3 ხმა")).toHaveLength(2);

    fireEvent.click(fifth);
    expect(screen.queryByText(copy.DESIGN_ONLY_COPY.decisionFails)).toBeNull();
  });
});
