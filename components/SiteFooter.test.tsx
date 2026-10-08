import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./SiteFooter";

const LINKS = [
  { href: "/join/terms", label: "Terms" },
  { href: "/support", label: "Contact" },
];

describe("SiteFooter (ADR-046)", () => {
  it("is a solid teal band with paper text and no ink top rule", () => {
    render(<SiteFooter copyright="(c) 2026" links={LINKS} />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveClass("bg-teal", "text-paper");
    expect(footer).not.toHaveClass("bg-paper");
    expect(footer).not.toHaveClass("border-t-2");
  });

  it("keeps links paper-coloured, with a paper focus outline (red on teal is 1.00:1)", () => {
    render(<SiteFooter copyright="(c) 2026" links={LINKS} />);
    for (const name of ["Terms", "Contact"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveClass("text-paper", "hover:decoration-2", "focus-visible:outline-paper");
      expect(link).not.toHaveClass("text-ink");
    }
  });
});
