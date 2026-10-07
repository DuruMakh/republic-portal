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
  notFound: () => {
    throw new Error("not-found");
  },
}));

import BillingPage from "./page";

beforeEach(() => {
  vi.stubEnv("SHOW_MEMBERSHIP_DUES", undefined);
  server.getCabinetState.mockResolvedValue(cabinetStateFixture());
  server.createServerSupabase.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("payments page while dues are hidden (the default, ADR-036)", () => {
  it("answers not-found before reading any payment", async () => {
    await expect(BillingPage()).rejects.toThrow("not-found");
    expect(server.createServerSupabase).not.toHaveBeenCalled();
  });
});
