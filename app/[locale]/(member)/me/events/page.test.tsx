import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({ createServerSupabase: vi.fn() }));
vi.mock("@/lib/supabase/server", () => server);
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not-found");
  },
}));

import MemberEventsPage from "./page";

beforeEach(() => {
  vi.stubEnv("SHOW_EVENTS", undefined);
  server.createServerSupabase.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cabinet events page while events are hidden (the default, ADR-042)", () => {
  it("answers not-found before reading any event", async () => {
    await expect(MemberEventsPage()).rejects.toThrow("not-found");
    expect(server.createServerSupabase).not.toHaveBeenCalled();
  });
});
