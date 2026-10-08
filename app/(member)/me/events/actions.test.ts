import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";

const server = vi.hoisted(() => ({ createServerSupabase: vi.fn() }));
vi.mock("@/lib/supabase/server", () => server);

import { rsvpAction } from "./actions";

const VALID = { eventId: "6f1c2a7e-8a43-4d6e-9b1a-3c2d4e5f6a7b", going: true };

beforeEach(() => {
  vi.stubEnv("SHOW_EVENTS", undefined);
  server.createServerSupabase.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("rsvpAction (ADR-042)", () => {
  it("refuses while events are hidden, before touching the database", async () => {
    expect(await rsvpAction(VALID)).toEqual({ ok: false, error: GENERIC_FUNNEL_ERROR });
    expect(server.createServerSupabase).not.toHaveBeenCalled();
  });

  it("calls member_rsvp once SHOW_EVENTS=true", async () => {
    vi.stubEnv("SHOW_EVENTS", "true");
    const rpc = vi.fn().mockResolvedValue({ error: null });
    server.createServerSupabase.mockResolvedValue({ rpc });

    expect(await rsvpAction(VALID)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("member_rsvp", { p_event_id: VALID.eventId, p_going: true });
  });
});
