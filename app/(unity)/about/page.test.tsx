import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as copy from "@/lib/about-copy";
import { mtavruli } from "@/lib/mtavruli";
import { MEMBERS_LEAD } from "@/lib/structure-copy";
import AboutPage, { metadata } from "./page";

beforeEach(() => {
  vi.stubEnv("SHOW_RATINGS", undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/about", () => {
  it("opens with the headline and the three numbered beliefs", () => {
    render(<AboutPage />);
    expect(screen.getByRole("heading", { level: 1, name: copy.ABOUT_INTRO })).toBeInTheDocument();
    const beliefs = screen.getByRole("list", { name: copy.ABOUT_INTRO });
    const items = within(beliefs).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(
      copy.ABOUT_BELIEFS.map((belief, i) => `0${i + 1}${belief}`),
    );
  });

  it("carries the unity band, the three goal steps and the portal text", () => {
    render(<AboutPage />);
    expect(screen.getByText(copy.ABOUT_UNITY_CLOSE)).toBeInTheDocument();
    expect(screen.getByText(copy.ABOUT_UNITY_CLOSE).parentElement).toHaveTextContent(
      copy.ABOUT_UNITY,
    );

    const goal = screen.getByRole("heading", { level: 2, name: copy.ABOUT_GOAL_TITLE });
    const steps = within(goal.closest("section")!).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    copy.ABOUT_GOAL_STEPS.forEach((step, i) => {
      expect(steps[i]).toHaveTextContent(`0${i + 1} · ${mtavruli(step.label)}`);
      expect(steps[i]).toHaveTextContent(step.text);
    });

    expect(screen.getByText(copy.ABOUT_PORTAL_LEAD)).toBeInTheDocument();
    expect(screen.getByText(copy.ABOUT_PORTAL_SUB)).toBeInTheDocument();
    for (const card of copy.ABOUT_PORTAL_CARDS) {
      expect(screen.getByText(card.title)).toBeInTheDocument();
    }
  });

  it("links the portal cards to joining, the delegate rules and the structure", () => {
    render(<AboutPage />);
    expect(screen.getByRole("link", { name: "გახდი მხარდამჭერი →" })).toHaveAttribute(
      "href",
      "/join",
    );
    expect(screen.getByRole("link", { name: "გაეცანი წესებს →" })).toHaveAttribute(
      "href",
      "/join/terms",
    );
    expect(screen.getByRole("link", { name: "ორგანიზაციული სტრუქტურა →" })).toHaveAttribute(
      "href",
      "/structure",
    );
  });

  it("orders the portal cards supporter, member, delegate, common vote", () => {
    render(<AboutPage />);
    const cards = screen.getByText("ლიდერების არჩევა").closest("ul")!;
    const items = within(cards).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent(mtavruli("მხარდამჭერი"));
    expect(items[1]).toHaveTextContent("ორგანიზება");
    expect(items[1]).toHaveTextContent(mtavruli("წევრი"));
    expect(items[1]).toHaveTextContent(MEMBERS_LEAD);
    expect(within(items[1]!).getByRole("link", { name: "როგორ ხდები წევრი →" })).toHaveAttribute(
      "href",
      "/structure#members",
    );
    expect(items[2]).toHaveTextContent("ლიდერების არჩევა");
    expect(items[2]).toHaveTextContent(mtavruli("დელეგატი"));
    expect(items[2]).toHaveTextContent("მოძრაობის წარმომადგენელი თავის ქალაქში, სოფელში, უბანში.");
    expect(within(items[2]!).getByRole("link", { name: "გაეცანი წესებს →" })).toHaveAttribute(
      "href",
      "/join/terms",
    );
    expect(items[3]).toHaveTextContent(mtavruli("საერთო კენჭისყრა"));
  });

  it("never links the portal cards to the delegate ranking", () => {
    vi.stubEnv("SHOW_RATINGS", "true");
    render(<AboutPage />);
    expect(screen.queryByText(mtavruli("დელეგატების რეიტინგი"))).not.toBeInTheDocument();
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("href", "/leaderboard");
    }
  });

  it("has the roots section at #roots with the documents and the seven dates", () => {
    const { container } = render(<AboutPage />);
    const roots = container.querySelector("section#roots");
    expect(roots).not.toBeNull();
    const scope = within(roots as HTMLElement);
    expect(scope.getByRole("heading", { level: 2, name: "1918 — 1991" })).toBeInTheDocument();
    expect(scope.getByText(copy.ABOUT_ROOTS_INTRO)).toBeInTheDocument();
    for (const doc of copy.ABOUT_DOCUMENTS) {
      expect(scope.getByRole("button", { name: `გადიდება — ${doc.name}` })).toBeInTheDocument();
    }
    const timeline = scope.getByRole("list", { name: "ქრონოლოგია" });
    const entries = within(timeline).getAllByRole("listitem");
    expect(entries).toHaveLength(7);
    expect(entries[0]).toHaveTextContent("1918");
    expect(entries[0]).toHaveTextContent(copy.ABOUT_TIMELINE_FLAG);
    expect(entries[6]).toHaveTextContent("დამოუკიდებლობის აღდგენა");
  });

  it("closes with the shared band and a link to contact us", () => {
    render(<AboutPage />);
    expect(screen.getByRole("heading", { level: 2, name: "ერთად შეგვიძლია." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "დაგვიკავშირდი →" })).toHaveAttribute(
      "href",
      "/support",
    );
  });

  it("carries the site-name suffix in its title", () => {
    expect(metadata.title).toBe(`${copy.ABOUT_TITLE} — ქართული რესპუბლიკა`);
  });
});
