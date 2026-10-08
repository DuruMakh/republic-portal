import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

import PublicLayout from "./layout";

const FINANCES = "ფინანსები";
const MENU = "მენიუ";

function renderLayout() {
  render(
    <PublicLayout>
      <p>page body</p>
    </PublicLayout>,
  );
}

beforeEach(() => {
  // Hidden is the default: pin it, so a SHOW_PUBLIC_FINANCES exported in the caller's shell cannot
  // flip these tests. The public-mode tests below stub it to "true" themselves.
  vi.stubEnv("SHOW_PUBLIC_FINANCES", undefined);
  vi.stubEnv("SHOW_EVENTS", undefined);
  nav.pathname = "/";
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public layout — finances hidden (the default)", () => {
  it("lists no ფინანსები link in the header or the footer, and links nowhere to /transparency", () => {
    renderLayout();
    expect(
      within(screen.getByRole("banner")).queryByRole("link", { name: FINANCES }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("contentinfo")).queryByRole("link", { name: FINANCES }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/transparency"]')).toBeNull();
  });

  it("keeps ფინანსები out of the phone menu", () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: MENU }));
    expect(
      within(screen.getByRole("dialog")).queryByRole("link", { name: FINANCES }),
    ).not.toBeInTheDocument();
  });
});

describe("public layout — finances public (SHOW_PUBLIC_FINANCES=true)", () => {
  it("restores the ფინანსები link in the header and the footer", () => {
    vi.stubEnv("SHOW_PUBLIC_FINANCES", "true");
    renderLayout();
    expect(
      within(screen.getByRole("banner")).getByRole("link", { name: FINANCES }),
    ).toHaveAttribute("href", "/transparency");
    expect(
      within(screen.getByRole("contentinfo")).getByRole("link", { name: FINANCES }),
    ).toHaveAttribute("href", "/transparency");
  });
});

describe("public layout — structure link", () => {
  const STRUCTURE = "სტრუქტურა";

  it("links სტრუქტურა from the header, the footer and the phone menu", () => {
    renderLayout();
    expect(
      within(screen.getByRole("banner")).getByRole("link", { name: STRUCTURE }),
    ).toHaveAttribute("href", "/structure");
    expect(
      within(screen.getByRole("contentinfo")).getByRole("link", { name: STRUCTURE }),
    ).toHaveAttribute("href", "/structure");
    fireEvent.click(screen.getByRole("button", { name: MENU }));
    expect(
      within(screen.getByRole("dialog")).getByRole("link", { name: STRUCTURE }),
    ).toHaveAttribute("href", "/structure");
  });
});

describe("public layout — news and events live on the homepage, not the header", () => {
  const NEWS = "სიახლეები";
  const EVENTS = "ღონისძიებები";

  it("drops სიახლეები and ღონისძიებები from the header and the phone menu", () => {
    renderLayout();
    const header = screen.getByRole("banner");
    expect(within(header).queryByRole("link", { name: NEWS })).not.toBeInTheDocument();
    expect(within(header).queryByRole("link", { name: EVENTS })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: MENU }));
    const menu = screen.getByRole("dialog");
    expect(within(menu).queryByRole("link", { name: NEWS })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("link", { name: EVENTS })).not.toBeInTheDocument();
  });

  it("keeps სიახლეები in the footer", () => {
    renderLayout();
    expect(
      within(screen.getByRole("contentinfo")).getByRole("link", { name: NEWS }),
    ).toHaveAttribute("href", "/news");
  });
});

describe("public layout — events (ADR-042)", () => {
  const EVENTS = "ღონისძიებები";

  it("lists no ღონისძიებები link in the header, the footer or the phone menu while hidden", () => {
    renderLayout();
    expect(
      within(screen.getByRole("banner")).queryByRole("link", { name: EVENTS }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/events"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: MENU }));
    expect(
      within(screen.getByRole("dialog")).queryByRole("link", { name: EVENTS }),
    ).not.toBeInTheDocument();
  });

  it("keeps ღონისძიებები out of the header even once SHOW_EVENTS=true (owner, ADR-038)", () => {
    // Switching events back on restores the homepage section and the cabinets (ADR-042), but
    // the public header stays მთავარი · რეიტინგი · სტრუქტურა by the owner's later decision.
    vi.stubEnv("SHOW_EVENTS", "true");
    renderLayout();
    expect(
      within(screen.getByRole("banner")).queryByRole("link", { name: EVENTS }),
    ).not.toBeInTheDocument();
  });
});

describe("public layout on an old event address (ADR-042)", () => {
  it("gives the not-found page no back link to the hidden events index", () => {
    nav.pathname = "/events/tbilisi-meeting";
    renderLayout();
    expect(document.querySelector('a[href="/events"]')).toBeNull();
  });
});

describe("public layout — privacy policy link", () => {
  it("links the privacy policy from the footer, right after the rules", () => {
    renderLayout();
    const footer = screen.getByRole("contentinfo");
    const labels = within(footer)
      .getAllByRole("link")
      .map((l) => l.textContent);
    expect(labels.indexOf("კონფიდენციალურობა")).toBe(labels.indexOf("წესები") + 1);
    expect(within(footer).getByRole("link", { name: "კონფიდენციალურობა" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
