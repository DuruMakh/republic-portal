import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as copy from "@/lib/about-copy";
import AboutPage, { metadata } from "./page";

describe("/about", () => {
  it("renders the owner's text in full, the three beliefs as a list", () => {
    render(<AboutPage />);
    expect(screen.getByRole("heading", { level: 1, name: copy.ABOUT_TITLE })).toBeInTheDocument();
    for (const text of [copy.ABOUT_INTRO, copy.ABOUT_UNITY, copy.ABOUT_GOAL, copy.ABOUT_PURPOSE]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([...copy.ABOUT_BELIEFS]);
  });

  it("carries the site-name suffix in its title", () => {
    expect(metadata.title).toBe(`${copy.ABOUT_TITLE} — ქართული რესპუბლიკა`);
  });
});
