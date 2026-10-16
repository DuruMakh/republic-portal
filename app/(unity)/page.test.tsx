import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCountKa } from "@/lib/format";
import { HOME_NEWS_EMPTY } from "@/lib/home-copy";
import { PRINCIPLES } from "@/lib/principles-copy";

const data = vi.hoisted(() => ({
  fetchPublicStats: vi.fn(),
  fetchPublicDelegates: vi.fn(),
  fetchTransparencyStats: vi.fn(),
  fetchPublicNews: vi.fn(),
  fetchPublicEvents: vi.fn(),
}));
vi.mock("@/lib/supabase/public", () => data);

import HomePage from "./page";

// formatCountKa groups digits with a no-break space, which Testing Library's text matcher
// normalizes to a plain space before comparing, so expectations are normalized the same way.
const count = (n: number) => formatCountKa(n).replace(/\s+/g, " ");

function newsItem(i: number, image_url: string | null = null) {
  return {
    id: `00000000-0000-0000-0000-00000000000${i}`,
    slug: `news-${i}`,
    title: `სიახლე ${i}`,
    body: "ტექსტი",
    image_url,
    published_at: `2026-10-0${i}T10:00:00Z`,
  };
}

beforeEach(() => {
  // Hidden is the default for every switch: pin it, so a value exported in the caller's shell
  // cannot flip these tests.
  vi.stubEnv("SHOW_PUBLIC_FINANCES", undefined);
  vi.stubEnv("SHOW_EVENTS", undefined);
  vi.stubEnv("SHOW_RATINGS", undefined);
  for (const fetcher of Object.values(data)) fetcher.mockReset();
  data.fetchPublicStats.mockResolvedValue({
    approved_delegates: 12,
    active_members: 1636,
    registered_total: 1906,
    members_total: 1774,
  });
  data.fetchPublicDelegates.mockResolvedValue([]);
  data.fetchPublicNews.mockResolvedValue([]);
  data.fetchPublicEvents.mockResolvedValue([]);
  data.fetchTransparencyStats.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("hero", () => {
  it("carries the headline, the supporter button and the principles link", async () => {
    render(await HomePage());

    expect(
      screen.getByRole("heading", { level: 1, name: "ერთად შევქმნათ ქართული რესპუბლიკა" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "გახდი მხარდამჭერი" })).toHaveAttribute(
      "href",
      "/join",
    );
    expect(screen.getByRole("link", { name: "გაეცანი პრინციპებს →" })).toHaveAttribute(
      "href",
      "/principles",
    );
  });
});

describe("mission counters", () => {
  it("shows the real supporter, member and delegate counts, never a placeholder", async () => {
    render(await HomePage());

    expect(screen.getByTestId("stat-registered-total")).toHaveTextContent(count(1906));
    expect(screen.getByTestId("stat-members-total")).toHaveTextContent(count(1774));
    expect(screen.getByTestId("stat-approved-delegates")).toHaveTextContent("12");
    const mission = screen.getByRole("region", { name: "პორტალის მიზანი" });
    for (const label of ["მხარდამჭერი", "წევრი", "დელეგატი"]) {
      expect(within(mission).getByText(label, { exact: true })).toBeInTheDocument();
    }
    expect(document.body).not.toHaveTextContent("[000]");
  });

  it("lists the four steps of the path in order", async () => {
    render(await HomePage());

    const mission = screen.getByRole("region", { name: "პორტალის მიზანი" });
    const steps = within(mission)
      .getAllByRole("listitem")
      .map((li) => li.lastElementChild?.textContent);
    expect(steps).toEqual(["გაერთიანდება", "ორგანიზდება", "აირჩევს ლიდერებს", "ერთად გაიმარჯვებს"]);
  });
});

describe("how to join", () => {
  it("sends each step to its door", async () => {
    render(await HomePage());

    const join = screen.getByRole("region", { name: "როგორ შემოგვიერთდები" });
    expect(within(join).getByRole("link", { name: "გახდი მხარდამჭერი →" })).toHaveAttribute(
      "href",
      "/join",
    );
    expect(within(join).getByRole("link", { name: "დაიწყე რეგისტრაციით →" })).toHaveAttribute(
      "href",
      "/join",
    );
    expect(within(join).getByRole("link", { name: "გაეცანი წესებს →" })).toHaveAttribute(
      "href",
      "/join/terms",
    );
  });
});

describe("principles preview", () => {
  it("lists the twelve principles, each opening its place on /principles", async () => {
    render(await HomePage());

    const section = screen.getByRole("region", { name: "რა გვაერთიანებს" });
    expect(within(section).getByRole("link", { name: "ყველა პრინციპი →" })).toHaveAttribute(
      "href",
      "/principles",
    );
    expect(within(section).getByRole("link", { name: "ყველა პრინციპი · 12" })).toHaveAttribute(
      "href",
      "/principles",
    );
    PRINCIPLES.forEach(({ title }, i) => {
      expect(within(section).getByRole("link", { name: title })).toHaveAttribute(
        "href",
        `/principles#principle-${i + 1}`,
      );
    });
    expect(within(section).getByText("„ძალა ერთობაშია“")).toBeInTheDocument();
  });
});

describe("structure preview", () => {
  it("links to the structure page", async () => {
    render(await HomePage());

    const section = screen.getByRole("region", { name: "ორგანიზაციული სტრუქტურა" });
    expect(
      within(section).getByRole("link", { name: "ორგანიზაციული სტრუქტურა →" }),
    ).toHaveAttribute("href", "/structure");
  });
});

describe("news", () => {
  it("shows the three latest items, linked, with the hatched stand-in when there is no photo", async () => {
    data.fetchPublicNews.mockResolvedValue([
      newsItem(4, "https://example.test/4.jpg"),
      newsItem(3),
      newsItem(2),
      newsItem(1),
    ]);

    render(await HomePage());

    const section = screen.getByRole("region", { name: "სიახლეები" });
    expect(within(section).getByRole("link", { name: "სრულად →" })).toHaveAttribute(
      "href",
      "/news",
    );
    const cards = within(section)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/news/"));
    expect(cards.map((a) => a.getAttribute("href"))).toEqual([
      "/news/news-4",
      "/news/news-3",
      "/news/news-2",
    ]);
    expect(cards[0]).toHaveTextContent("სიახლე 4");
    expect(cards[0]).toHaveTextContent("04.10.2026");
    expect(cards[0]!.querySelector("img")).toHaveAttribute("src", "https://example.test/4.jpg");
    expect(cards[1]!.querySelector("img")).toBeNull();
    expect(cards[1]!.querySelector("[data-news-placeholder]")).not.toBeNull();
    expect(section).not.toHaveTextContent("[ფოტო]");
  });

  it("says news is coming when there is none", async () => {
    render(await HomePage());

    expect(screen.getByRole("region", { name: "სიახლეები" })).toHaveTextContent(HOME_NEWS_EMPTY);
  });
});

describe("roots", () => {
  it("quotes the act, lists the four milestones and links to the full story", async () => {
    render(await HomePage());

    const section = screen.getByRole("region", { name: "პირველი რესპუბლიკა" });
    for (const year of ["1918", "1919", "1921", "1991"]) {
      expect(within(section).getByText(year, { exact: true })).toBeInTheDocument();
    }
    expect(within(section).getByRole("link", { name: "ჩვენი ფესვები — სრულად →" })).toHaveAttribute(
      "href",
      "/about#roots",
    );
    expect(
      within(section).getByRole("button", {
        name: "გადიდება — საქართველოს დამოუკიდებლობის აქტი, ხელმოწერებით",
      }),
    ).toBeInTheDocument();
  });
});

describe("closing", () => {
  it("ends with the closing band and the teal ornament right above the footer", async () => {
    const { container } = render(await HomePage());

    expect(screen.getByRole("heading", { level: 2, name: "ერთად შეგვიძლია." })).toBeInTheDocument();
    const main = container.querySelector("main")!;
    const last = main.lastElementChild!;
    expect(last).toHaveAttribute("aria-hidden", "true");
    expect(last.className).toContain("ornament-teal");
    expect(last.previousElementSibling).toBe(
      screen.getByRole("region", { name: "ერთად შეგვიძლია." }),
    );
  });
});

describe("hidden surfaces", () => {
  it("has no ranking, no events and no finance figures, and fetches none of them", async () => {
    render(await HomePage());

    expect(document.querySelector('a[href="/leaderboard"]')).toBeNull();
    expect(document.querySelector('a[href="/events"]')).toBeNull();
    expect(screen.queryByText(/რეიტინგ/)).toBeNull();
    expect(screen.queryByText(/ღონისძიებ/)).toBeNull();
    expect(screen.queryByText(/შენატან/)).toBeNull();
    expect(data.fetchPublicDelegates).not.toHaveBeenCalled();
    expect(data.fetchPublicEvents).not.toHaveBeenCalled();
    expect(data.fetchTransparencyStats).not.toHaveBeenCalled();
  });

  it("still shows no ranking or events with every switch on (the design has no such section)", async () => {
    vi.stubEnv("SHOW_RATINGS", "true");
    vi.stubEnv("SHOW_EVENTS", "true");
    vi.stubEnv("SHOW_PUBLIC_FINANCES", "true");

    render(await HomePage());

    expect(document.querySelector('a[href="/leaderboard"]')).toBeNull();
    expect(document.querySelector('a[href="/events"]')).toBeNull();
    expect(data.fetchPublicDelegates).not.toHaveBeenCalled();
  });
});
