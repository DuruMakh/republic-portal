// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { rejectDelegateSchema } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import {
  adminTestHarness,
  fakeSession,
  ok,
  raised,
  type FakeHandlers,
} from "../_test-utils/fake-supabase";

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

const session = adminTestHarness(
  mocks,
  () => fakeSession({ rpc: () => ok(PERSONAL_ID), from: () => ok([]) }).client,
);
/** The applicant row an admin sees; the slug "taken" lookup gets an empty list. */
const applicant: FakeHandlers["from"] = (_t, chain) =>
  chain.some((c) => c.method === "single")
    ? ok({ first_name: "Nino", last_name: "Beridze" })
    : ok([]);

describe("approveDelegateAction", () => {
  it("rejects a non-uuid before creating any Supabase client", async () => {
    await expect(approveDelegateAction("not-a-uuid")).resolves.toEqual({
      ok: false,
      error: GENERIC_FUNNEL_ERROR,
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("a non-admin sees no applicant row, so no approval RPC is attempted", async () => {
    const s = session({ from: () => NO_ROWS });
    const res = await approveDelegateAction(delegateId);
    expect(res.ok).toBe(false);
    expect(s.rpcCalls()).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("surfaces a database refusal and does not revalidate", async () => {
    const s = session({ from: applicant, rpc: () => raised("missing_role") });
    await expect(approveDelegateAction(delegateId)).resolves.toEqual({
      ok: false,
      error: mapFunnelError("missing_role"),
    });
    expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_approve_delegate"]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("approves through the audited RPC with a server-computed slug", async () => {
    const s = session({
      from: applicant,
      rpc: (_n, args) => ok({ slug: (args as { p_slug: string }).p_slug }),
    });
    const res = await approveDelegateAction(delegateId);
    const rpc = s.rpcCalls();
    expect(rpc).toHaveLength(1);
    expect(rpc[0]).toMatchObject({
      name: "admin_approve_delegate",
      args: { p_delegate_id: delegateId, p_slug: expect.stringMatching(/^[a-z0-9-]+$/) },
    });
    expect(res).toEqual({ ok: true, slug: (rpc[0]!.args as { p_slug: string }).p_slug });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/verify");
  });
});

describe("rejectDelegateAction", () => {
  it("rejects a non-string note before creating any Supabase client", async () => {
    await expect(rejectDelegateAction(delegateId, { text: "x" })).resolves.toEqual({
      ok: false,
      error: GENERIC_FUNNEL_ERROR,
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("rejects a 501-character note before creating any Supabase client", async () => {
    const note = "n".repeat(501);
    await expect(rejectDelegateAction(delegateId, note)).resolves.toEqual({
      ok: false,
      error: rejectDelegateSchema.safeParse({ delegateId, note }).error?.issues[0]?.message,
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("surfaces a database refusal and does not revalidate", async () => {
    const s = session({ rpc: () => raised("missing_role") });
    await expect(rejectDelegateAction(delegateId, "")).resolves.toEqual({
      ok: false,
      error: mapFunnelError("missing_role"),
    });
    expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_reject_delegate"]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

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

  it.each(["missing_role", "invalid_target"])(
    "surfaces a database refusal (%s) with no ID in the result",
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
