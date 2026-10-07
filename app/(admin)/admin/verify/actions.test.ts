// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rejectDelegateSchema } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { fakeSession, ok, raised, type FakeHandlers } from "../_test-utils/fake-supabase";

/**
 * Delegate verification. Approve/reject and the applicant personal-ID reveal are
 * SECURITY DEFINER RPCs that re-check super_admin/verifier and audit in-DB
 * (ADR-014, pinned in lib/security/schema-guards.test.ts). The approve action
 * also reads the self-gating admin_delegate_queue view, which returns NO rows to
 * a non-admin — so a refused caller never reaches the RPC at all.
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

const { approveDelegateAction, rejectDelegateAction, revealApplicantIdAction } =
  await import("./actions");

const delegateId = "66666666-6666-4666-8666-666666666666";
const PERSONAL_ID = "01001054321";
/** What PostgREST answers `.single()` with when the self-gating view hides every row. */
const NO_ROWS = { data: null, error: { message: "no rows", code: "PGRST116" } };

function session(handlers: FakeHandlers = {}) {
  const s = fakeSession(handlers);
  mocks.createServerSupabase.mockResolvedValue(s.client);
  return s;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAdminClient.mockReturnValue(
    fakeSession({ rpc: () => ok(PERSONAL_ID), from: () => ok([]) }).client,
  );
});

describe("approveDelegateAction", () => {
  it.each([["not-a-uuid"], [42], [undefined]])(
    "rejects %j before creating any Supabase client",
    async (input) => {
      await expect(approveDelegateAction(input)).resolves.toEqual({
        ok: false,
        error: GENERIC_FUNNEL_ERROR,
      });
      expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    },
  );

  it("a non-admin sees no applicant row, so no approval RPC is attempted", async () => {
    const s = session({ from: () => NO_ROWS });
    const res = await approveDelegateAction(delegateId);
    expect(res.ok).toBe(false);
    expect(s.rpcCalls()).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["not_authenticated", "missing_role"])(
    "surfaces the RPC's %s refusal and revalidates nothing",
    async (token) => {
      const s = session({
        from: (_t, chain) =>
          chain.some((c) => c.method === "single")
            ? ok({ first_name: "Nino", last_name: "Beridze" })
            : ok([]),
        rpc: () => raised(token),
      });
      await expect(approveDelegateAction(delegateId)).resolves.toEqual({
        ok: false,
        error: mapFunnelError(token),
      });
      expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_approve_delegate"]);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
      expect(mocks.createAdminClient).not.toHaveBeenCalled();
    },
  );

  it("approves through the audited RPC with a server-computed slug", async () => {
    const s = session({
      from: (_t, chain) =>
        chain.some((c) => c.method === "single")
          ? ok({ first_name: "Nino", last_name: "Beridze" })
          : ok([]),
      rpc: (_n, args) => ok({ slug: (args as { p_slug: string }).p_slug }),
    });
    const res = await approveDelegateAction(delegateId);
    const rpc = s.rpcCalls();
    expect(rpc).toHaveLength(1);
    expect(rpc[0]).toMatchObject({
      name: "admin_approve_delegate",
      args: { p_delegate_id: delegateId, p_slug: expect.stringMatching(/^[a-z0-9-]+$/) },
    });
    const slug = (rpc[0]!.args as { p_slug: string }).p_slug;
    expect(res).toEqual({ ok: true, slug });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/verify");
  });
});

describe("rejectDelegateAction", () => {
  it.each([
    { label: "a non-string delegate id", id: 42, note: "" },
    { label: "a non-string note", id: delegateId, note: { text: "x" } },
    { label: "a non-uuid delegate id", id: "x", note: "" },
    { label: "a 501-character note", id: delegateId, note: "n".repeat(501) },
  ])("rejects $label before creating any Supabase client", async ({ id, note }) => {
    const res = await rejectDelegateAction(id, note);
    const expected =
      typeof id === "string" && typeof note === "string"
        ? (rejectDelegateSchema.safeParse({ delegateId: id, note }).error?.issues[0]?.message ??
          GENERIC_FUNNEL_ERROR)
        : GENERIC_FUNNEL_ERROR;
    expect(res).toEqual({ ok: false, error: expected });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it.each(["not_authenticated", "missing_role"])(
    "surfaces the RPC's %s refusal and revalidates nothing",
    async (token) => {
      const s = session({ rpc: () => raised(token) });
      await expect(rejectDelegateAction(delegateId, "")).resolves.toEqual({
        ok: false,
        error: mapFunnelError(token),
      });
      expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_reject_delegate"]);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("rejects through the audited RPC only (blank note sent as null)", async () => {
    const s = session({ rpc: () => ok() });
    await expect(rejectDelegateAction(delegateId, "   ")).resolves.toEqual({ ok: true });
    expect(s.calls).toEqual([
      {
        kind: "rpc",
        name: "admin_reject_delegate",
        args: { p_delegate_id: delegateId, p_note: null },
        chain: [],
      },
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/verify");
  });
});

describe("revealApplicantIdAction", () => {
  it("rejects a non-uuid before creating any Supabase client", async () => {
    await expect(revealApplicantIdAction("x")).resolves.toEqual({
      ok: false,
      error: GENERIC_FUNNEL_ERROR,
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it.each(["not_authenticated", "missing_role", "invalid_target"])(
    "surfaces the RPC's %s refusal with no ID in the result",
    async (token) => {
      const s = session({ rpc: () => raised(token) });
      const res = await revealApplicantIdAction(delegateId);
      expect(res).toEqual({ ok: false, error: mapFunnelError(token) });
      expect(JSON.stringify(res)).not.toContain(PERSONAL_ID);
      expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_reveal_applicant_personal_id"]);
      expect(mocks.createAdminClient).not.toHaveBeenCalled();
    },
  );

  it("reveals only via the audited RPC — no table read, no service role", async () => {
    const s = session({ rpc: () => ok(PERSONAL_ID) });
    await expect(revealApplicantIdAction(delegateId)).resolves.toEqual({
      ok: true,
      personalId: PERSONAL_ID,
    });
    expect(s.calls).toEqual([
      {
        kind: "rpc",
        name: "admin_reveal_applicant_personal_id",
        args: { p_delegate_id: delegateId },
        chain: [],
      },
    ]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
