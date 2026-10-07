// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { fakeSession, ok, raised } from "../_test-utils/fake-supabase";

/**
 * Reassigning a member moves their delegate binding (ADR-013). The RPC re-checks
 * super_admin/verifier and audits member.reassign in-DB (ADR-014, pinned in
 * lib/security/schema-guards.test.ts); the action validates first and goes
 * through the caller's session.
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

const { reassignMemberAction } = await import("./actions");

const memberId = "44444444-4444-4444-8444-444444444444";
const delegateId = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAdminClient.mockReturnValue(fakeSession({ rpc: () => ok() }).client);
});

describe("reassignMemberAction", () => {
  it.each([
    { label: "a non-uuid member", m: "x", d: delegateId },
    { label: "a non-uuid delegate", m: memberId, d: "GR-ABCDEF" },
    { label: "a missing delegate", m: memberId, d: undefined },
  ])("rejects $label before creating any Supabase client", async ({ m, d }) => {
    await expect(reassignMemberAction(m, d)).resolves.toEqual({
      ok: false,
      error: GENERIC_FUNNEL_ERROR,
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it.each(["not_authenticated", "missing_role"])(
    "surfaces the RPC's %s refusal and revalidates nothing",
    async (token) => {
      const s = fakeSession({ rpc: () => raised(token) });
      mocks.createServerSupabase.mockResolvedValue(s.client);
      await expect(reassignMemberAction(memberId, delegateId)).resolves.toEqual({
        ok: false,
        error: mapFunnelError(token),
      });
      expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_reassign_member"]);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
      expect(mocks.createAdminClient).not.toHaveBeenCalled();
    },
  );

  it("reassigns through the audited RPC only", async () => {
    const s = fakeSession({ rpc: () => ok() });
    mocks.createServerSupabase.mockResolvedValue(s.client);
    await expect(reassignMemberAction(memberId, delegateId)).resolves.toEqual({ ok: true });
    expect(s.calls).toEqual([
      {
        kind: "rpc",
        name: "admin_reassign_member",
        args: { p_member_id: memberId, p_delegate_id: delegateId },
        chain: [],
      },
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/transfer");
  });
});
