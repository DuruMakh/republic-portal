import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobileBackHeader } from "./MobileBackHeader";

describe("MobileBackHeader", () => {
  it("links to the declared parent, not to browser history", () => {
    render(<MobileBackHeader href="/news" label="სიახლეები" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/news");
  });

  it("shows the context label so you know which section you are inside", () => {
    render(<MobileBackHeader href="/news" label="სიახლეები" />);
    expect(screen.getByText("სიახლეები")).toBeInTheDocument();
  });

  it("uses the same masthead rule as the Masthead (ADR-048)", () => {
    const { container } = render(<MobileBackHeader href="/news" label="News" />);
    const header = container.firstElementChild as HTMLElement;
    expect(header).toHaveClass("masthead-rule");
    expect(header).not.toHaveClass("border-b-2");
  });

  it("renders a header landmark", () => {
    const { container } = render(<MobileBackHeader href="/news" label="სიახლეები" />);
    expect((container.firstElementChild as HTMLElement).tagName).toBe("HEADER");
  });

  it("puts the context label in brand red at or above the 0.74rem floor", () => {
    render(<MobileBackHeader href="/news" label="სიახლეები" />);
    const contextLabel = screen.getByText("სიახლეები");
    expect(contextLabel.className).toContain("text-brand");
    // DESIGN.md sets 0.74rem as a hard minimum ("No micro-print below it").
    // Asserting the size class is the point of this test — without it a future
    // edit could shrink the label under the floor and still pass.
    expect(contextLabel.className).toContain("text-[0.74rem]");
  });
});
