import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mtavruli } from "@/lib/mtavruli";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("next/font/local", () => ({ default: () => ({ variable: "font-var" }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

import UnityLayout from "./layout";

const RATING_HEADER = mtavruli("რეიტინგი");
const MENU = "მენიუ";

function renderLayout() {
  render(
    <UnityLayout>
      <p>page body</p>
    </UnityLayout>,
  );
}

beforeEach(() => {
  vi.stubEnv("SHOW_RATINGS", undefined);
  nav.pathname = "/about";
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ერთობა layout", () => {
  it("shows the design's header links in Georgian capitals and marks the current page", () => {
    renderLayout();
    const header = within(screen.getByRole("banner"));
    const about = header.getByRole("link", { name: mtavruli("ჩვენ შესახებ") });
    expect(about).toHaveAttribute("href", "/about");
    expect(about).toHaveAttribute("aria-current", "page");
    expect(header.getByRole("link", { name: mtavruli("სტრუქტურა") })).toHaveAttribute(
      "href",
      "/structure",
    );
    expect(header.getByRole("link", { name: mtavruli("შემოგვიერთდი") })).toHaveAttribute(
      "href",
      "/join",
    );
  });

  it("hides every ranking link while ratings are hidden (the default)", () => {
    renderLayout();
    expect(document.querySelector('a[href="/leaderboard"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: MENU }));
    expect(
      within(screen.getByRole("dialog")).queryByRole("link", { name: RATING_HEADER }),
    ).not.toBeInTheDocument();
  });

  it("brings the ranking link back in the header and footer when SHOW_RATINGS=true", () => {
    vi.stubEnv("SHOW_RATINGS", "true");
    renderLayout();
    expect(
      within(screen.getByRole("banner")).getByRole("link", { name: RATING_HEADER }),
    ).toHaveAttribute("href", "/leaderboard");
    expect(
      within(screen.getByRole("contentinfo")).getByRole("link", { name: "რეიტინგი" }),
    ).toHaveAttribute("href", "/leaderboard");
  });

  it("opens the phone menu as a dialog and closes it with Escape", () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: MENU }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("link", { name: mtavruli("პრინციპები") })).toHaveAttribute(
      "href",
      "/principles",
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("gives phones a back bar instead of the header on a detail page, and no join bar on /join", () => {
    nav.pathname = "/join/terms";
    renderLayout();
    const back = screen.getByRole("link", { name: "← უკან" });
    expect(back).toHaveAttribute("href", "/join");
    // Only the header's own join button: no phone join bar here.
    expect(screen.getAllByRole("link", { name: mtavruli("შემოგვიერთდი") })).toHaveLength(1);
  });

  it("shows the phone join bar on the redesigned pages and no back bar", () => {
    renderLayout();
    expect(screen.queryByRole("link", { name: "← უკან" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: mtavruli("შემოგვიერთდი") })).toHaveLength(2);
  });

  it("keeps ფინანსები out of the footer unless SHOW_PUBLIC_FINANCES=true", () => {
    vi.stubEnv("SHOW_PUBLIC_FINANCES", undefined);
    renderLayout();
    expect(document.querySelector('a[href="/transparency"]')).toBeNull();
  });

  it("lists ფინანსები beside the rules link when finances are public", () => {
    vi.stubEnv("SHOW_PUBLIC_FINANCES", "true");
    renderLayout();
    expect(
      within(screen.getByRole("contentinfo")).getByRole("link", { name: "ფინანსები" }),
    ).toHaveAttribute("href", "/transparency");
  });

  it("puts the footer links, the rules and privacy links and the copyright in the teal footer", () => {
    renderLayout();
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByRole("link", { name: "სიახლეები" })).toHaveAttribute("href", "/news");
    expect(footer.getByRole("link", { name: "დაგვიკავშირდი" })).toHaveAttribute("href", "/support");
    expect(footer.getByRole("link", { name: "წესები" })).toHaveAttribute("href", "/join/terms");
    expect(footer.getByText("© 2026 ქართული რესპუბლიკა — ღია ჩანაწერი")).toBeInTheDocument();
  });
});
