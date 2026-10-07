// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pollFormSchema } from "@/lib/content-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { fakeSession, ok, raised } from "../../_test-utils/fake-supabase";

/**
 * Polls. Every mutation is a SECURITY DEFINER RPC that re-checks
 * super_admin/editor and audits in-DB (ADR-014, pinned in
 * lib/security/schema-guards.test.ts). The actions validate first, go through
 * the caller's session, and report refusals without revalidating.
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

const { closePollAction, deletePollAction, openPollAction, savePollAction } =
  await import("./actions");

const pollId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAdminClient.mockReturnValue(fakeSession({ rpc: () => ok() }).client);
});

describe("savePollAction", () => {
  const valid = { question: "Question?", options: ["Yes", "No"], endsAt: "" };

  it.each([
    { label: "a single option", input: { ...valid, options: ["Yes"] } },
    { label: "duplicate options", input: { ...valid, options: ["Yes", "Yes"] } },
    { label: "an empty question", input: { ...valid, question: "" } },
  ])("rejects $label before creating any Supabase client", async ({ input }) => {
    await expect(savePollAction(input)).resolves.toEqual({
      ok: false,
      error: pollFormSchema.safeParse(input).error?.issues[0]?.message ?? GENERIC_FUNNEL_ERROR,
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it.each(["not_authenticated", "missing_role"])("surfaces the RPC's %s refusal", async (token) => {
    const s = fakeSession({ rpc: () => raised(token) });
    mocks.createServerSupabase.mockResolvedValue(s.client);
    await expect(savePollAction(valid)).resolves.toEqual({
      ok: false,
      error: mapFunnelError(token),
    });
    expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_save_poll"]);
  });

  it("saves through the audited RPC with the exact arguments", async () => {
    const s = fakeSession({ rpc: () => ok(pollId) });
    mocks.createServerSupabase.mockResolvedValue(s.client);
    await expect(savePollAction(valid)).resolves.toEqual({ ok: true, id: pollId });
    expect(s.calls).toEqual([
      {
        kind: "rpc",
        name: "admin_save_poll",
        args: { p_id: null, p_question: "Question?", p_options: ["Yes", "No"], p_ends_at: null },
        chain: [],
      },
    ]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});

describe.each([
  { name: "openPollAction", action: openPollAction, rpc: "admin_open_poll" },
  { name: "closePollAction", action: closePollAction, rpc: "admin_close_poll" },
  { name: "deletePollAction", action: deletePollAction, rpc: "admin_delete_poll" },
])("$name", ({ action, rpc }) => {
  it.each([["x"], [1], [undefined]])("rejects id %j before creating any client", async (id) => {
    await expect(action(id)).resolves.toEqual({ ok: false, error: GENERIC_FUNNEL_ERROR });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it.each(["not_authenticated", "missing_role"])(
    "surfaces the RPC's %s refusal and revalidates nothing",
    async (token) => {
      const s = fakeSession({ rpc: () => raised(token) });
      mocks.createServerSupabase.mockResolvedValue(s.client);
      await expect(action(pollId)).resolves.toEqual({ ok: false, error: mapFunnelError(token) });
      expect(s.rpcCalls().map((c) => c.name)).toEqual([rpc]);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("calls only the audited RPC, with the poll id", async () => {
    const s = fakeSession({ rpc: () => ok() });
    mocks.createServerSupabase.mockResolvedValue(s.client);
    await expect(action(pollId)).resolves.toEqual({ ok: true });
    expect(s.calls).toEqual([{ kind: "rpc", name: rpc, args: { p_id: pollId }, chain: [] }]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
