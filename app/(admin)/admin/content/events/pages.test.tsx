import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({ createServerSupabase: vi.fn() }));
vi.mock("@/lib/supabase/server", () => server);
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not-found");
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import AdminEventsListPage from "./page";
import EditEventPage from "./[id]/page";
import NewEventPage from "./new/page";

beforeEach(() => {
  vi.stubEnv("SHOW_EVENTS", undefined);
  server.createServerSupabase.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin events pages while events are hidden (the default, ADR-038)", () => {
  it("the list answers not-found before reading any event", async () => {
    await expect(AdminEventsListPage()).rejects.toThrow("not-found");
    expect(server.createServerSupabase).not.toHaveBeenCalled();
  });

  it("the new-event form answers not-found", () => {
    expect(() => NewEventPage()).toThrow("not-found");
  });

  it("the edit page answers not-found before reading the event", async () => {
    const params = Promise.resolve({ id: "6f1c2a7e-8a43-4d6e-9b1a-3c2d4e5f6a7b" });
    await expect(EditEventPage({ params })).rejects.toThrow("not-found");
    expect(server.createServerSupabase).not.toHaveBeenCalled();
  });
});
