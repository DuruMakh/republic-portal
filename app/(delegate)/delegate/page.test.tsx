import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cabinetStateFixture } from "@/lib/test-cabinet-state";

const server = vi.hoisted(() => ({
  getCabinetState: vi.fn(),
  createServerSupabase: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => server);
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

import DelegateDashboardPage from "./page";

const TEAM_RSVP = "გუნდის RSVP";
const rpc = vi.fn();

beforeEach(() => {
  vi.stubEnv("SHOW_EVENTS", undefined);
  rpc.mockReset();
  rpc.mockImplementation((name: string) =>
    Promise.resolve(
      name === "delegate_panel"
        ? {
            data: {
              status: "approved",
              referralCode: null,
              activeCount: 0,
              totalCount: 3,
              registeredCount: 1,
              referralCount: 0,
            },
            error: null,
          }
        : { data: [], error: null },
    ),
  );
  server.getCabinetState.mockResolvedValue(
    cabinetStateFixture({ standing: "member", role: "delegate", delegateStatus: "approved" }),
  );
  server.createServerSupabase.mockResolvedValue({
    rpc,
    from: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u-1" } }, error: null }) },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("delegate panel — team RSVP card (ADR-042)", () => {
  it("has no team-RSVP card and never asks for the team's sign-ups while events are hidden", async () => {
    render(await DelegateDashboardPage());

    expect(screen.queryByText(TEAM_RSVP)).not.toBeInTheDocument();
    expect(screen.queryByTestId("team-rsvp")).not.toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalledWith("delegate_team_rsvps");
  });

  it("brings the card back once SHOW_EVENTS=true", async () => {
    vi.stubEnv("SHOW_EVENTS", "true");

    render(await DelegateDashboardPage());

    expect(screen.getByTestId("team-rsvp")).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("delegate_team_rsvps");
  });
});
