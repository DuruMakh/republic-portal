import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cabinetStateFixture } from "@/lib/test-cabinet-state";

const server = vi.hoisted(() => ({
  getCabinetState: vi.fn(),
  createServerSupabase: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => server);
vi.mock("next/navigation", () => ({
  usePathname: () => "/me/profile",
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("@/components/useSignOut", () => ({ useSignOut: () => vi.fn() }));

import MemberLayout from "./layout";

const NAV = "კაბინეტის ნავიგაცია";

async function renderLayout() {
  render(await MemberLayout({ children: <p>page body</p> }));
}

beforeEach(() => {
  vi.stubEnv("SHOW_EVENTS", undefined);
  vi.stubEnv("SHOW_MEMBERSHIP_DUES", undefined);
  server.getCabinetState.mockResolvedValue(cabinetStateFixture());
  server.createServerSupabase.mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u-1" } } }) },
    from: () => ({ select: () => ({ eq: () => Promise.resolve({ count: 0 }) }) }),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("member cabinet nav — events (ADR-038)", () => {
  it("offers no events destination, on desktop or the phone bar, while hidden", async () => {
    await renderLayout();
    expect(document.querySelector('a[href="/me/events"]')).toBeNull();
    // the phone bar fills the freed slot with the member's delegate
    expect(document.querySelectorAll('a[href="/me/delegate"]').length).toBe(2);
  });

  it("brings the events tab back once SHOW_EVENTS=true", async () => {
    vi.stubEnv("SHOW_EVENTS", "true");
    await renderLayout();
    // desktop nav first, then the phone bar (which uses the singular label)
    const [desktop, phone] = screen.getAllByRole("navigation", { name: NAV });
    expect(within(desktop!).getByRole("link", { name: "ღონისძიებები" })).toHaveAttribute(
      "href",
      "/me/events",
    );
    expect(within(phone!).getByRole("link", { name: "ღონისძიება" })).toHaveAttribute(
      "href",
      "/me/events",
    );
  });
});
