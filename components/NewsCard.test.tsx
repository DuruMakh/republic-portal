import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pill } from "./Pill";
import { NewsCard } from "./NewsCard";

describe("NewsCard", () => {
  it("renders a link with title, date and excerpt", () => {
    render(
      <NewsCard
        href="/news/testi"
        title="სატესტო სიახლე"
        publishedAt="19.07.2026"
        imageUrl={null}
        excerptText="მოკლე შინაარსი…"
      />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/news/testi");
    expect(screen.getByText("სატესტო სიახლე")).toBeInTheDocument();
    expect(screen.getByText("19.07.2026")).toBeInTheDocument();
    expect(screen.getByText("მოკლე შინაარსი…")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders the cover thumbnail and an optional pill", () => {
    render(
      <NewsCard
        href="/me/news/shida"
        title="შიდა"
        publishedAt="18.07.2026"
        imageUrl="https://x.supabase.co/storage/v1/object/public/news-images/a.png"
        excerptText="ტექსტი"
        pill={<Pill status="pending" label="წევრებისთვის" />}
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://x.supabase.co/storage/v1/object/public/news-images/a.png",
    );
    expect(screen.getByText("წევრებისთვის")).toBeInTheDocument();
  });
});
