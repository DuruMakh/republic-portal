import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BallotBar } from "./Ballot";

describe("BallotBar", () => {
  it.each([
    ["brand", "bg-brand"],
    ["ink", "bg-ink"],
    ["muted", "bg-muted-fg"],
  ] as const)("the fill is pct wide and coloured by tone %s", (tone, toneClass) => {
    const { container } = render(<BallotBar label="Yes" pct={45} tone={tone} />);
    const fill = container.querySelector<HTMLElement>("[style*='width: 45%']");
    expect(fill).not.toBeNull();
    expect(fill?.classList.contains(toneClass)).toBe(true);
  });

  it("renders the label and the pct", () => {
    render(<BallotBar label="Yes votes" pct={45} tone="brand" />);
    expect(screen.getByText("Yes votes")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
  });

  it("renders value in place of pct when provided, fill width still from pct", () => {
    const { container } = render(<BallotBar label="თბილისი" pct={45} tone="brand" value="1 204" />);
    expect(screen.getByText("1 204")).toBeInTheDocument();
    expect(screen.queryByText("45")).not.toBeInTheDocument();
    expect(container.querySelector("[style*='width: 45%']")).not.toBeNull();
  });
});
