import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PRINCIPLES, PRINCIPLES_TITLE } from "@/lib/principles-copy";
import PrinciplesPage, { metadata } from "./page";

describe("/principles", () => {
  it("renders every principle, numbered, with its full text", () => {
    const { container } = render(<PrinciplesPage />);
    expect(screen.getByRole("heading", { level: 1, name: PRINCIPLES_TITLE })).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(
      PRINCIPLES.map((p, i) => `${i + 1}. ${p.title}`),
    );
    for (const { paragraphs } of PRINCIPLES) {
      for (const text of paragraphs) expect(screen.getByText(text)).toBeInTheDocument();
    }
    const index = screen.getByRole("navigation", { name: PRINCIPLES_TITLE });
    const links = within(index).getAllByRole("link");
    expect(links).toHaveLength(12);
    PRINCIPLES.forEach(({ title }, i) => {
      const link = links[i];
      expect(link).toHaveTextContent(title);
      expect(link).toHaveAttribute("href", `#principle-${i + 1}`);
      expect(container.querySelector(`#principle-${i + 1}`)).not.toBeNull();
    });
  });

  it("carries the site-name suffix in its tab title", () => {
    expect(metadata.title).toBe(`${PRINCIPLES_TITLE} — ქართული რესპუბლიკა`);
  });
});
