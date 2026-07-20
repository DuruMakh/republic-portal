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
  it("renders rows with dates and status labels", () => {
    render(<TeamTable members={MEMBERS} />);
    // status labels are scoped to the table body: the status-filter <select>
    // has options with this exact same Georgian text ("აქტიური" /
    // "რეგისტრირებული"), which would otherwise make screen.getByText ambiguous.
    const rows = screen.getByTestId("team-rows");
    expect(screen.getByText("ნინო ბერიძე")).toBeInTheDocument();
    expect(screen.getByText("10.07.2026")).toBeInTheDocument();
    expect(within(rows).getByText("აქტიური")).toBeInTheDocument();
    expect(within(rows).getByText("წევრი")).toBeInTheDocument();
  });

  it("filters by search and by status", () => {
    render(<TeamTable members={MEMBERS} />);
    fireEvent.change(screen.getByLabelText("ძებნა სახელით ან გვარით"), {
      target: { value: "გიორგი" },
    });
    expect(screen.queryByText("ნინო ბერიძე")).not.toBeInTheDocument();
    expect(screen.getByText("გიორგი წიკლაური")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("ძებნა სახელით ან გვარით"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("სტატუსის ფილტრი"), {
      target: { value: "active_member" },
    });
    expect(screen.getByText("ნინო ბერიძე")).toBeInTheDocument();
    expect(screen.queryByText("გიორგი წიკლაური")).not.toBeInTheDocument();
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
