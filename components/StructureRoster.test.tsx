import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StructureRoster } from "./StructureRoster";

const member = {
  name: "Test Member",
  photo: "/board/test-member.jpg",
  socials: [{ network: "facebook" as const, url: "https://www.facebook.com/test" }],
};

describe("StructureRoster", () => {
  it("a member without a bio gets a card with only photo, name and links", () => {
    render(<StructureRoster members={[member]} heading="ბორდი" notice="მალე" seats={5} />);
    const card = screen.getByRole("listitem");
    expect(within(card).getByRole("img", { name: "Test Member" })).toBeInTheDocument();
    expect(within(card).getByText("Test Member")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /Test Member/ })).toBeInTheDocument();
    // Only the name carries lang="ka": no empty bio line under it.
    expect(card.querySelectorAll('[lang="ka"]')).toHaveLength(1);
  });

  it("shows a member's bio when there is one", () => {
    render(
      <StructureRoster
        members={[{ ...member, bio: "Short bio." }]}
        heading="ბორდი"
        notice="მალე"
        seats={5}
      />,
    );
    expect(screen.getByText("Short bio.")).toBeInTheDocument();
  });
});
