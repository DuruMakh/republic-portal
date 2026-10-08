import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";

const server = vi.hoisted(() => ({ createServerSupabase: vi.fn() }));
vi.mock("@/lib/supabase/server", () => server);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  cancelEventAction,
  deleteEventAction,
  publishEventAction,
  saveEventAction,
} from "./actions";

const ID = "6f1c2a7e-8a43-4d6e-9b1a-3c2d4e5f6a7b";
const REFUSED = { ok: false, error: GENERIC_FUNNEL_ERROR };

beforeEach(() => {
  vi.stubEnv("SHOW_EVENTS", undefined);
  server.createServerSupabase.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin event actions while events are hidden (the default, ADR-042)", () => {
  it("refuses to save, publish, cancel or delete, before touching the database", async () => {
    const form = {
      title: "შეხვედრა",
      description: "აღწერა",
      location: "თბილისი",
      startsAt: "2030-01-01T10:00",
      endsAt: "",
    };
    expect(await saveEventAction(form)).toEqual(REFUSED);
    expect(await publishEventAction(ID)).toEqual(REFUSED);
    expect(await cancelEventAction(ID)).toEqual(REFUSED);
    expect(await deleteEventAction(ID)).toEqual(REFUSED);
    expect(server.createServerSupabase).not.toHaveBeenCalled();
  });

  it("acts again once SHOW_EVENTS=true", async () => {
    vi.stubEnv("SHOW_EVENTS", "true");
    const rpc = vi.fn().mockResolvedValue({ error: null });
    server.createServerSupabase.mockResolvedValue({ rpc });

    expect(await deleteEventAction(ID)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("admin_delete_event", { p_id: ID });
  });
});
