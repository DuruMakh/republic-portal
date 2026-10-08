import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardMemberCard } from "./BoardMemberCard";

describe("BoardMemberCard", () => {
  it("shows the photo with the name as alt text, the name, the bio and the links", () => {
    render(
      <BoardMemberCard
        member={{
          name: "Test Member",
          photo: "/board/test-member.jpg",
          bio: "Short bio.",
          socials: [{ network: "facebook", url: "https://www.facebook.com/t" }],
        }}
      />,
    );
    expect(screen.getByRole("img", { name: "Test Member" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Test Member" })).toBeInTheDocument();
    expect(screen.getByText("Short bio.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Facebook: Test Member" })).toBeInTheDocument();
  });
});
