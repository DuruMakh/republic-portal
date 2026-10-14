import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeClosing } from "./HomeClosing";

describe("HomeClosing", () => {
  it("closes the homepage with its own level-2 heading", () => {
    render(<HomeClosing />);
    expect(
      screen.getByRole("heading", { level: 2, name: "ქართული რესპუბლიკა შენით იწყება" }),
    ).toBeInTheDocument();
  });

  it("sends the reader to sign up as a supporter", () => {
    render(<HomeClosing />);
    expect(screen.getByRole("link", { name: "გახდი მხარდამჭერი" })).toHaveAttribute(
      "href",
      "/join",
    );
  });

  it("offers the structure page as the second step", () => {
    render(<HomeClosing />);
    expect(screen.getByRole("link", { name: "როგორ ვართ მოწყობილი" })).toHaveAttribute(
      "href",
      "/structure",
    );
  });
});

describe("HomeClosing focus ring", () => {
  it("gives both links a paper focus outline, since red on red is invisible", () => {
    render(<HomeClosing />);
    for (const name of ["გახდი მხარდამჭერი", "როგორ ვართ მოწყობილი"]) {
      expect(screen.getByRole("link", { name })).toHaveClass("focus-visible:outline-paper");
    }
  });
});
