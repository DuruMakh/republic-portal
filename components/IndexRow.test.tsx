import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IndexRow } from "./IndexRow";

describe("IndexRow", () => {
  it("rank 1 gets text-brand color and testid rank-1", () => {
    render(<IndexRow rank={1} name="Alice" meta="Region A" figure="100" figureLabel="votes" />);
    const rankSpan = screen.getByTestId("rank-1");
    expect(rankSpan).toBeInTheDocument();
    expect(rankSpan).toHaveClass("text-brand");
  });

  it("rank 2 gets text-muted-fg color", () => {
    render(<IndexRow rank={2} name="Bob" meta="Region B" figure="90" figureLabel="votes" />);
    const rankSpan = screen.getByTestId("rank-2");
    expect(rankSpan).toHaveClass("text-muted-fg");
  });

  it("name renders inside a link when href is passed", () => {
    render(
      <IndexRow
        rank={1}
        name="Alice"
        meta="Region A"
        figure="100"
        figureLabel="votes"
        href="/alice"
      />,
    );
    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/alice");
    expect(link).toHaveClass("no-underline");
    expect(link).toHaveClass("hover:text-brand");
    expect(link).toHaveClass("text-ink");
  });

  it("name renders without a link when href is not passed", () => {
    render(<IndexRow rank={1} name="Alice" meta="Region A" figure="100" figureLabel="votes" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
