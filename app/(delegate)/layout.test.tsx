import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cabinetStateFixture } from "@/lib/test-cabinet-state";

const server = vi.hoisted(() => ({
  getCabinetState: vi.fn(),
  createServerSupabase: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => server);
vi.mock("next/navigation", () => ({
  usePathname: () => "/delegate",
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("@/components/useSignOut", () => ({ useSignOut: () => vi.fn() }));

import DelegateLayout from "./layout";

const NAV = "კაბინეტის ნავიგაცია";

async function renderLayout() {
  render(await DelegateLayout({ children: <p>page body</p> }));
}

beforeEach(() => {
  vi.stubEnv("SHOW_EVENTS", undefined);
  vi.stubEnv("SHOW_MEMBERSHIP_DUES", undefined);
  server.getCabinetState.mockResolvedValue(
    cabinetStateFixture({ standing: "member", role: "delegate", delegateStatus: "approved" }),
  );
  server.createServerSupabase.mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u-1" } } }) },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("delegate cabinet nav — events (ADR-038)", () => {
  it("offers no events destination while hidden; the phone bar gains the profile", async () => {
    await renderLayout();
    expect(document.querySelector('a[href="/me/events"]')).toBeNull();
    const [, phone] = screen.getAllByRole("navigation", { name: NAV });
    expect(within(phone!).getByRole("link", { name: "პროფილი" })).toHaveAttribute(
      "href",
      "/me/profile",
    );
  });

  it("brings the events tab back once SHOW_EVENTS=true", async () => {
    vi.stubEnv("SHOW_EVENTS", "true");
    await renderLayout();
    const [desktop] = screen.getAllByRole("navigation", { name: NAV });
    expect(within(desktop!).getByRole("link", { name: "ღონისძიებები" })).toHaveAttribute(
      "href",
      "/me/events",
    );
  });
});
