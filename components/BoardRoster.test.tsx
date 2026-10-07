import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardRoster } from "./BoardRoster";

const member = {
  name: "Test Member",
  photo: "/board/test-member.jpg",
  bio: "Short bio.",
  socials: [],
};

describe("BoardRoster", () => {
  it("with no members: the heading, the coming-soon notice and decorative placeholders", () => {
    const { container } = render(
      <BoardRoster members={[]} heading="ბორდის შემადგენლობა" notice="მალე" placeholders={5} />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "ბორდის შემადგენლობა" }),
    ).toBeInTheDocument();
    expect(screen.getByText("მალე")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "ბორდის შემადგენლობა" })).toHaveAttribute(
      "id",
      "roster",
    );
    // Any variant (e.g. motion-safe:animate-pulse): the spec lets only the council seats move.
    expect(container.querySelector('[class*="animate-pulse"]')).toBeNull();
    expect(container.querySelectorAll('[data-placeholder="true"]')).toHaveLength(5);
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("with members: one card each, and no notice or placeholders", () => {
    const { container } = render(
      <BoardRoster
        members={[member, { ...member, name: "Second Member" }]}
        heading="ბორდის შემადგენლობა"
        notice="მალე"
        placeholders={5}
      />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByText("მალე")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-placeholder="true"]')).toHaveLength(0);
  });
});
