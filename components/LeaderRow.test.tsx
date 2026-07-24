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
  it("rank 1 renders `1.` in text-brand, with no gold-gradient classes and no medal emoji", () => {
    render(<LeaderRow delegate={mk(1)} />);
    const rank = screen.getByTestId("rank-1");
    expect(rank).toHaveTextContent("1.");
    expect(rank).toHaveClass("text-brand");
    expect(rank.className).not.toMatch(/gradient/);
    expect(rank.className).not.toMatch(/gold/);
    expect(screen.queryByText("🥇")).not.toBeInTheDocument();
  });
  it("rank 2 renders `2.` in text-muted-fg, no silver-gradient classes or medal emoji", () => {
    render(<LeaderRow delegate={mk(2)} />);
    const rank = screen.getByTestId("rank-2");
    expect(rank).toHaveTextContent("2.");
    expect(rank).toHaveClass("text-muted-fg");
    expect(rank.className).not.toMatch(/gradient/);
    expect(screen.queryByText("🥈")).not.toBeInTheDocument();
  });
  it("rank 3 renders `3.`, no bronze-gradient classes or medal emoji", () => {
    render(<LeaderRow delegate={mk(3)} />);
    const rank = screen.getByTestId("rank-3");
    expect(rank).toHaveTextContent("3.");
    expect(rank.className).not.toMatch(/gradient/);
    expect(screen.queryByText("🥉")).not.toBeInTheDocument();
  });
  it("shows the plain rank number from rank 4 on, via its rank-{n} testid", () => {
    render(<LeaderRow delegate={mk(4)} />);
    expect(screen.getByTestId("rank-4")).toHaveTextContent("4.");
  });
  it("links to the delegate page and shows name, region, count", () => {
    render(<LeaderRow delegate={mk(2)} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/delegates/delegate-2");
    expect(screen.getByText("ეკა მელაძე")).toBeInTheDocument();
    expect(screen.getByText("გურია")).toBeInTheDocument();
    expect(screen.getByText("84")).toBeInTheDocument();
  });
});
