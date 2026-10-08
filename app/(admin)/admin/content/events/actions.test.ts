// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventFormSchema } from "@/lib/content-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { adminTestHarness, ok, raised } from "../../_test-utils/fake-supabase";

/**
 * Events. Two states (ADR-042):
 * - hidden (the default — SHOW_EVENTS unset or anything but "true"): the editor
 *   pages answer not-found and every action refuses a direct call before any
 *   Supabase client exists;
 * - shown (SHOW_EVENTS=true): every mutation is a SECURITY DEFINER RPC that
 *   re-checks super_admin/editor and audits in-DB (ADR-014, pinned in
 *   lib/security/schema-guards.test.ts); the actions validate first, go through
 *   the caller's session, and report refusals without revalidating.
 * SHOW_EVENTS is stubbed per test and restored after.
 */

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: mocks.createServerSupabase }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const { cancelEventAction, deleteEventAction, publishEventAction, saveEventAction } =
  await import("./actions");

const session = adminTestHarness(mocks);
const eventId = "99999999-9999-4999-8999-999999999999";
const validForm = {
  title: "Title",
  description: "Description",
  location: "Tbilisi",
  startsAt: "2026-11-01T18:00",
  endsAt: "",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("while events are hidden (the default, ADR-042)", () => {
  it.each([
    { label: "unset", value: undefined },
    { label: "anything but the word true", value: "false" },
  ])(
    "SHOW_EVENTS $label: all four actions refuse before any client or RPC exists",
    async ({ value }) => {
      vi.stubEnv("SHOW_EVENTS", value);
      // a working session that WOULD succeed — only the switch can refuse
      const s = session({ rpc: () => ok(eventId), from: () => ok({ title: "Title", slug: "t" }) });
      const refused = { ok: false, error: GENERIC_FUNNEL_ERROR };
      expect(await saveEventAction(validForm)).toEqual(refused);
      expect(await publishEventAction(eventId)).toEqual(refused);
      expect(await cancelEventAction(eventId)).toEqual(refused);
      expect(await deleteEventAction(eventId)).toEqual(refused);
      expect(mocks.createServerSupabase).not.toHaveBeenCalled();
      expect(mocks.createAdminClient).not.toHaveBeenCalled();
      expect(s.calls).toEqual([]);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );
});

describe("while events are shown (SHOW_EVENTS=true)", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_EVENTS", "true");
  });

  describe("saveEventAction", () => {
    it.each([
      { label: "a malformed start", input: { ...validForm, startsAt: "tomorrow" } },
      { label: "an end before the start", input: { ...validForm, endsAt: "2026-11-01T17:00" } },
    ])("rejects $label before creating any Supabase client", async ({ input }) => {
      await expect(saveEventAction(input)).resolves.toEqual({
        ok: false,
        error: eventFormSchema.safeParse(input).error?.issues[0]?.message ?? GENERIC_FUNNEL_ERROR,
      });
      expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    });

    it("surfaces a database refusal and does not revalidate", async () => {
      const s = session({ rpc: () => raised("missing_role") });
      await expect(saveEventAction(validForm)).resolves.toEqual({
        ok: false,
        error: mapFunnelError("missing_role"),
      });
      expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_save_event"]);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("saves through the audited RPC with Tbilisi wall time converted to an instant", async () => {
      const s = session({ rpc: () => ok(eventId), from: () => ok({ slug: null }) });
      await expect(saveEventAction(validForm)).resolves.toEqual({ ok: true, id: eventId });
      expect(s.rpcCalls()).toEqual([
        {
          kind: "rpc",
          name: "admin_save_event",
          args: {
            p_id: null,
            p_title: "Title",
            p_description: "Description",
            p_location: "Tbilisi",
            p_starts_at: "2026-11-01T14:00:00.000Z",
            p_ends_at: null,
          },
          chain: [],
        },
      ]);
      expect(mocks.createAdminClient).not.toHaveBeenCalled();
    });
  });

  describe.each([
    { name: "publishEventAction", action: publishEventAction, rpc: "admin_publish_event" },
    { name: "cancelEventAction", action: cancelEventAction, rpc: "admin_cancel_event" },
    { name: "deleteEventAction", action: deleteEventAction, rpc: "admin_delete_event" },
  ])("$name", ({ action, rpc }) => {
    it("rejects a non-uuid id before creating any client", async () => {
      await expect(action("x")).resolves.toEqual({ ok: false, error: GENERIC_FUNNEL_ERROR });
      expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    });

    it("surfaces a database refusal and does not revalidate", async () => {
      const s = session({
        from: () => ok({ title: "Title", slug: "title" }),
        rpc: () => raised("missing_role"),
      });
      await expect(action(eventId)).resolves.toEqual({
        ok: false,
        error: mapFunnelError("missing_role"),
      });
      expect(s.rpcCalls().map((c) => c.name)).toEqual([rpc]);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
      expect(mocks.createAdminClient).not.toHaveBeenCalled();
    });

    it("calls the audited RPC with the event id", async () => {
      const s = session({
        from: () => ok({ title: "Title", slug: "title" }),
        rpc: () => ok({ slug: "title" }),
      });
      await expect(action(eventId)).resolves.toEqual({ ok: true });
      expect(s.rpcCalls()).toHaveLength(1);
      expect(s.rpcCalls()[0]).toMatchObject({ name: rpc, args: { p_id: eventId } });
    });
  });
});
