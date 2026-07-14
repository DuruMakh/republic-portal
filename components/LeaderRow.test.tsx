import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RankedDelegate } from "@/lib/ranking";
import { LeaderRow } from "./LeaderRow";

const mk = (rank: number): RankedDelegate => ({
  id: `00000000-0000-0000-0000-00000000000${rank}`,
  slug: `delegate-${rank}`,
  first_name: "ეკა",
  last_name: "მელაძე",
  region_id: 8,
  region_name_ka: "გურია",
  bio: null,
  photo_url: null,
  active_supporters: 84,
  rank,
});

describe("LeaderRow", () => {
  it("shows a gold medal for rank 1", () => {
    render(<LeaderRow delegate={mk(1)} />);
    expect(screen.getByText("🥇")).toBeInTheDocument();
  });
  it("shows the plain rank number from rank 4 on", () => {
    render(<LeaderRow delegate={mk(4)} />);
    expect(screen.getByText("4")).toBeInTheDocument();
  });
  it("links to the delegate page and shows name, region, count", () => {
    render(<LeaderRow delegate={mk(2)} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/delegates/delegate-2");
    expect(screen.getByText("ეკა მელაძე")).toBeInTheDocument();
    expect(screen.getByText("გურია")).toBeInTheDocument();
    expect(screen.getByText("84")).toBeInTheDocument();
  });
});
