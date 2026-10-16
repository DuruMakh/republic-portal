import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnityNewsTile } from "./UnityNewsTile";

const BASE = {
  href: "/news/testi",
  title: "სატესტო სიახლე",
  publishedAt: "19.07.2026",
  excerptText: "მოკლე შინაარსი…",
};

describe("UnityNewsTile", () => {
  it("links the whole tile to the article with its date and excerpt", () => {
    render(<UnityNewsTile {...BASE} imageUrl={null} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/news/testi");
    expect(screen.getByText("სატესტო სიახლე")).toBeInTheDocument();
    expect(screen.getByText("19.07.2026")).toBeInTheDocument();
    expect(screen.getByText("მოკლე შინაარსი…")).toBeInTheDocument();
  });

  it("draws the hatched stand-in when the article has no photo", () => {
    const { container } = render(<UnityNewsTile {...BASE} imageUrl={null} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-news-placeholder]")).not.toBeNull();
  });

  it("shows the cover photo without repeating the title to screen readers", () => {
    const { container } = render(
      <UnityNewsTile {...BASE} imageUrl="https://x.supabase.co/a.png" />,
    );
    const photo = container.querySelector("img");
    expect(photo).toHaveAttribute("src", "https://x.supabase.co/a.png");
    expect(photo).toHaveAttribute("alt", "");
    expect(screen.getByRole("link")).toHaveAccessibleName(/^სატესტო სიახლე/);
  });

  it("adds the section kicker on the lead story", () => {
    render(<UnityNewsTile {...BASE} imageUrl={null} lead />);
    expect(screen.getByText("ᲡᲘᲐᲮᲚᲔᲔᲑᲘ")).toBeInTheDocument();
  });
});
