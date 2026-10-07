// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { fakeSession, ok, raised, type FakeHandlers } from "../_test-utils/fake-supabase";

/**
 * Personal-ID reveal: one of exactly two audited paths that return a member's
 * personal ID to any client (ADR-014). The RPC re-checks super_admin and writes
 * member.reveal_personal_id before returning (pinned statically in
 * lib/security/schema-guards.test.ts). The action must never fetch the ID any
 * other way — no table read, no service-role client — and must never put an ID
 * in a refused result.
 */

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: mocks.createServerSupabase }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

const { revealPersonalIdAction } = await import("./actions");

const memberId = "33333333-3333-4333-8333-333333333333";
const PERSONAL_ID = "01001012345";

function session(handlers: FakeHandlers = {}) {
  const s = fakeSession(handlers);
  mocks.createServerSupabase.mockResolvedValue(s.client);
  return s;
}

beforeEach(() => {
  vi.clearAllMocks();
  // a service-role decoy that WOULD hand out the ID — only "never called" catches misuse
  mocks.createAdminClient.mockReturnValue(
    fakeSession({ rpc: () => ok(PERSONAL_ID), from: () => ok([{ personal_id: PERSONAL_ID }]) })
      .client,
  );
});

describe("revealPersonalIdAction", () => {
  it.each([
    { label: "a non-uuid", input: "GR-ABCDEF" },
    { label: "a number", input: 42 },
    { label: "an object", input: { id: memberId } },
    { label: "nothing", input: undefined },
  ])("rejects $label before creating any Supabase client", async ({ input }) => {
    await expect(revealPersonalIdAction(input)).resolves.toEqual({
      ok: false,
      error: GENERIC_FUNNEL_ERROR,
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it.each([
    { who: "an anonymous caller", token: "not_authenticated" },
    { who: "a verifier, finance or editor (super_admin only)", token: "missing_role" },
    { who: "an unknown member", token: "invalid_target" },
  ])("refuses $who with no ID anywhere in the result", async ({ token }) => {
    const s = session({ rpc: () => raised(token) });
    const res = await revealPersonalIdAction(memberId);
    expect(res).toEqual({ ok: false, error: mapFunnelError(token) });
    expect(JSON.stringify(res)).not.toContain(PERSONAL_ID);
    expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_reveal_personal_id"]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("reveals to a super_admin only via the audited RPC — no table read, no service role", async () => {
    const s = session({ rpc: () => ok(PERSONAL_ID) });
    await expect(revealPersonalIdAction(memberId)).resolves.toEqual({
      ok: true,
      personalId: PERSONAL_ID,
    });
    expect(s.calls).toEqual([
      { kind: "rpc", name: "admin_reveal_personal_id", args: { p_member_id: memberId }, chain: [] },
    ]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
