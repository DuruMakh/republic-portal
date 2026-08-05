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

  it("is hidden from md up", () => {
    const { container } = render(<MobileBackHeader href="/news" label="სიახლეები" />);
    expect((container.firstElementChild as HTMLElement).className).toContain("md:hidden");
  });

  it("stays at the top while the mobile document scrolls", () => {
    const { container } = render(<MobileBackHeader href="/news" label="სიახლეები" />);
    const header = container.firstElementChild as HTMLElement;
    expect(header.className).toContain("sticky");
    expect(header.className).toContain("top-0");
    expect(header.className).toContain("bg-paper");
  });

  it("renders a header landmark over a 2px ink rule", () => {
    const { container } = render(<MobileBackHeader href="/news" label="სიახლეები" />);
    const header = container.firstElementChild as HTMLElement;
    expect(header.tagName).toBe("HEADER");
    expect(header.className).toContain("border-b-2");
    expect(header.className).toContain("border-ink");
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
