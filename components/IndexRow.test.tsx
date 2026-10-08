import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IndexRow } from "./IndexRow";

describe("IndexRow", () => {
  it("marks only rank 1 in brand colour", () => {
    render(<IndexRow rank={1} name="Alice" meta="Region A" figure="100" figureLabel="votes" />);
    render(<IndexRow rank={2} name="Bob" meta="Region B" figure="90" figureLabel="votes" />);
    expect(screen.getByTestId("rank-1")).toHaveClass("text-brand");
    expect(screen.getByTestId("rank-2")).not.toHaveClass("text-brand");
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
  });

  it("name renders without a link when href is not passed", () => {
    render(<IndexRow rank={1} name="Alice" meta="Region A" figure="100" figureLabel="votes" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
