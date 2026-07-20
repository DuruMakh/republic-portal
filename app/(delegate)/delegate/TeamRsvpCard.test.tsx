import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TeamRsvpCard } from "./TeamRsvpCard";

describe("TeamRsvpCard", () => {
  it("renders one row per upcoming event with the team going count and names", () => {
    render(
      <TeamRsvpCard
        events={[
          {
            eventId: "e1",
            title: "საერთო კრება",
            startsAt: "2026-07-26T15:00:00.000Z",
            goingCount: 2,
            going: [
              { firstName: "ნინო", lastName: "ბერიძე" },
              { firstName: "გიორგი", lastName: "ლომიძე" },
            ],
          },
          {
            eventId: "e2",
            title: "ვორქშოპი",
            startsAt: "2026-08-02T15:00:00.000Z",
            goingCount: 0,
            going: [],
          },
        ]}
      />,
    );
    expect(screen.getByText("საერთო კრება")).toBeInTheDocument();
    expect(screen.getByText("შენი გუნდიდან მოდის 2")).toBeInTheDocument();
    expect(screen.getByText("ნინო ბერიძე")).toBeInTheDocument();
    expect(screen.getByText("შენი გუნდიდან მოდის 0")).toBeInTheDocument();
  });

  it("renders the empty state when there are no upcoming events", () => {
    render(<TeamRsvpCard events={[]} />);
    expect(screen.getByText("მომავალი ღონისძიებები ჯერ არ არის.")).toBeInTheDocument();
  });
});
