import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TeamMember } from "@/lib/cabinet";
import { TeamTable } from "./TeamTable";

// @testing-library/user-event is not in devDependencies (checked package.json) —
// fireEvent from @testing-library/react stands in for the type/select interactions.
const MEMBERS: TeamMember[] = [
  {
    firstName: "ნინო",
    lastName: "ბერიძე",
    registeredAt: "2026-07-10T09:00:00Z",
    status: "active_member",
  },
  {
    firstName: "გიორგი",
    lastName: "წიკლაური",
    registeredAt: "2026-07-14T12:00:00Z",
    status: "profile_completed",
  },
];

describe("TeamTable", () => {
  it("renders rows with dates, and every member reads plainly as member (ADR-037)", () => {
    render(<TeamTable members={MEMBERS} />);
    const rows = screen.getByTestId("team-rows");
    expect(screen.getByText("ნინო ბერიძე")).toBeInTheDocument();
    expect(screen.getByText("10.07.2026")).toBeInTheDocument();
    expect(within(rows).getAllByText("წევრი")).toHaveLength(2);
  });

  it("has no status filter — both statuses are the same word now (ADR-037)", () => {
    render(<TeamTable members={MEMBERS} />);
    expect(screen.queryByLabelText("სტატუსის ფილტრი")).toBeNull();
  });

  it("filters by search", () => {
    render(<TeamTable members={MEMBERS} />);
    fireEvent.change(screen.getByLabelText("ძებნა სახელით ან გვარით"), {
      target: { value: "გიორგი" },
    });
    expect(screen.queryByText("ნინო ბერიძე")).not.toBeInTheDocument();
    expect(screen.getByText("გიორგი წიკლაური")).toBeInTheDocument();
  });

  it("shows the empty state for a fresh delegate and a no-results state when filtered", () => {
    const { rerender } = render(<TeamTable members={[]} />);
    expect(screen.getByTestId("team-empty")).toHaveTextContent(
      "ჯერ არავინ დარეგისტრირებულა შენი ბმულით",
    );
    rerender(<TeamTable members={MEMBERS} />);
    fireEvent.change(screen.getByLabelText("ძებნა სახელით ან გვარით"), {
      target: { value: "zzz" },
    });
    expect(screen.getByTestId("team-no-results")).toBeInTheDocument();
  });
});
