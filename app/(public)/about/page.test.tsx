import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as copy from "@/lib/about-copy";
import AboutPage, { metadata } from "./page";

describe("/about", () => {
  it("renders the owner's text word for word", () => {
    render(<AboutPage />);
    expect(screen.getByRole("heading", { level: 1, name: copy.ABOUT_TITLE })).toBeInTheDocument();
    for (const text of [
      copy.ABOUT_INTRO,
      ...copy.ABOUT_BELIEFS,
      copy.ABOUT_UNITY,
      copy.ABOUT_GOAL,
      copy.ABOUT_PORTAL,
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("lists the three beliefs in order", () => {
    render(<AboutPage />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(
      copy.ABOUT_BELIEFS.map((b, i) => `${copy.ABOUT_BELIEF_MARKERS[i]}${b}`),
    );
  });

  it("ends with the join button", () => {
    render(<AboutPage />);
    expect(screen.getByRole("link", { name: "შემოგვიერთდი →" })).toHaveAttribute("href", "/join");
  });

  it("carries the site-name suffix in its title", () => {
    expect(metadata.title).toBe(`${copy.ABOUT_TITLE} — ქართული რესპუბლიკა`);
  });
});
