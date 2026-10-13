import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as copy from "@/lib/principles-copy";
import PrinciplesPage, { metadata } from "./page";

describe("/principles", () => {
  it("renders all twelve principles word for word, in order", () => {
    render(<PrinciplesPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: copy.PRINCIPLES_TITLE }),
    ).toBeInTheDocument();
    expect(copy.PRINCIPLES).toHaveLength(12);
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(copy.PRINCIPLES.map((p) => p.title));
    for (const { paragraphs } of copy.PRINCIPLES) {
      for (const text of paragraphs) expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("numbers each principle and links to it from the index", () => {
    const { container } = render(<PrinciplesPage />);
    const index = screen.getByRole("navigation", { name: copy.PRINCIPLES_TITLE });
    copy.PRINCIPLES.forEach(({ title }, i) => {
      const n = i + 1;
      const link = within(index).getByRole("link", { name: `${n} ${title}` });
      expect(link).toHaveAttribute("href", `#principle-${n}`);
      const section = container.querySelector(`#principle-${n}`);
      expect(section).toHaveTextContent(`${n}${title}`);
    });
  });

  it("ends with the join button", () => {
    render(<PrinciplesPage />);
    expect(screen.getByRole("link", { name: "შემოგვიერთდი →" })).toHaveAttribute("href", "/join");
  });

  it("carries the site-name suffix in its title", () => {
    expect(metadata.title).toBe(`${copy.PRINCIPLES_TITLE} — ქართული რესპუბლიკა`);
  });
});
