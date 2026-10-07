import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cabinetStateFixture } from "@/lib/test-cabinet-state";

const server = vi.hoisted(() => ({ getCabinetState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => server);
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

import CabinetOverviewPage from "./page";

const SUPPORTER = cabinetStateFixture({
  standing: "registered",
  status: "registered",
  completed: false,
  tier: null,
  referenceCode: null,
  membershipExists: false,
  registrationCompletedAt: null,
});

beforeEach(() => {
  vi.stubEnv("SHOW_MEMBERSHIP_DUES", undefined);
  vi.stubEnv("SHOW_EVENTS", undefined);
  server.getCabinetState.mockResolvedValue(SUPPORTER);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cabinet invitation to membership", () => {
  it("names no dues while they are hidden (the default, ADR-037)", async () => {
    render(await CabinetOverviewPage());

    expect(screen.getByText("წევრობა ხსნის მოძრაობის სრულ შესაძლებლობებს.")).toBeInTheDocument();
    expect(screen.queryByText(/₾|საწევრო/)).toBeNull();
  });

  it("names the monthly dues once they are on", async () => {
    vi.stubEnv("SHOW_MEMBERSHIP_DUES", "true");

    render(await CabinetOverviewPage());

    expect(screen.getByText(/ყოველთვიური საწევრო 10₾/)).toBeInTheDocument();
  });
});

describe("cabinet overview cards (ADR-038)", () => {
  it("shows the news card but no events card while events are hidden", async () => {
    render(await CabinetOverviewPage());

    expect(screen.getByRole("heading", { level: 3, name: "სიახლეები" })).toBeInTheDocument();
    expect(screen.queryByText(/ღონისძიებ/)).toBeNull();
    expect(document.querySelector('a[href="/me/events"]')).toBeNull();
  });

  it("brings the events card back once SHOW_EVENTS=true", async () => {
    vi.stubEnv("SHOW_EVENTS", "true");

    render(await CabinetOverviewPage());

    expect(screen.getByRole("heading", { level: 3, name: "ღონისძიებები" })).toBeInTheDocument();
    expect(document.querySelector('a[href="/me/events"]')).not.toBeNull();
  });
});
