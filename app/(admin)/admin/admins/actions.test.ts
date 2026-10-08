// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { adminTestHarness, ok, raised } from "../_test-utils/fake-supabase";

/**
 * Role grant/revoke are the keys to the whole admin panel. Authorization lives in
 * the SECURITY DEFINER RPCs (ADR-014: session check, super_admin check, last-
 * super_admin lockout guard, audit row — pinned statically in
 * lib/security/schema-guards.test.ts). What the ACTION must guarantee, and what
 * these tests pin: zod rejects garbage before any client exists; the call goes
 * through the caller's own session (never the service role, which would bypass
 * auth.uid() and with it every in-DB check); a refusal reaches the admin as the
 * mapped Georgian message and nothing is revalidated as if it had succeeded.
 */

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  getAdminRoles: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: mocks.createServerSupabase,
  getAdminRoles: mocks.getAdminRoles,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const { findAdminCandidateAction, grantRoleAction, revokeRoleAction } = await import("./actions");

const session = adminTestHarness(mocks);
const userId = "11111111-1111-4111-8111-111111111111";

describe.each([
  { name: "grantRoleAction", action: grantRoleAction, rpc: "admin_grant_role" },
  { name: "revokeRoleAction", action: revokeRoleAction, rpc: "admin_revoke_role" },
])("$name", ({ action, rpc }) => {
  it.each([
    { label: "a non-uuid user id", userId: "not-a-uuid", role: "finance" },
    { label: "an unknown role", userId, role: "owner" },
  ])("rejects $label before creating any Supabase client", async ({ userId: u, role }) => {
    await expect(action(u, role)).resolves.toEqual({ ok: false, error: GENERIC_FUNNEL_ERROR });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("surfaces a database refusal through the caller's session and does not revalidate", async () => {
    const s = session({ rpc: () => raised("missing_role") });
    await expect(action(userId, "finance")).resolves.toEqual({
      ok: false,
      error: mapFunnelError("missing_role"),
    });
    // the request did go to the database — under the CALLER's session, where
    // auth.uid() is what the in-DB role check reads
    expect(s.rpcCalls().map((c) => c.name)).toEqual([rpc]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("a valid request makes exactly the one audited RPC call, via the session client", async () => {
    const s = session({ rpc: () => ok() });
    await expect(action(userId, "verifier")).resolves.toEqual({ ok: true });
    // no direct table write: admin_roles and audit_log change ONLY inside the RPC,
    // in one transaction (ADR-014)
    expect(s.calls).toEqual([
      { kind: "rpc", name: rpc, args: { p_user_id: userId, p_role: "verifier" }, chain: [] },
    ]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/admins");
  });
});

describe("revokeRoleAction — the platform keeps at least one super_admin", () => {
  it("surfaces the lockout refusal as its own message and changes nothing", async () => {
    session({ rpc: () => raised("last_super_admin") });
    await expect(revokeRoleAction(userId, "super_admin")).resolves.toEqual({
      ok: false,
      error: mapFunnelError("last_super_admin"),
    });
    expect(mapFunnelError("last_super_admin")).not.toBe(GENERIC_FUNNEL_ERROR);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("findAdminCandidateAction — super_admin-only phone lookup", () => {
  it("rejects a malformed phone before reading roles or the database", async () => {
    const res = await findAdminCandidateAction("12345");
    expect(res.ok).toBe(false);
    expect(mocks.getAdminRoles).not.toHaveBeenCalled();
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it.each([[[]], [["verifier", "finance", "editor"]]])(
    "refuses roles %j without querying members",
    async (roles) => {
      mocks.getAdminRoles.mockResolvedValue(roles);
      await expect(findAdminCandidateAction("555 12 34 56")).resolves.toEqual({
        ok: false,
        error: mapFunnelError("missing_role"),
      });
      expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    },
  );

  it("lets a super_admin look a member up by both stored phone formats", async () => {
    mocks.getAdminRoles.mockResolvedValue(["super_admin"]);
    const s = session({
      from: () =>
        ok({
          id: userId,
          first_name: "Nino",
          last_name: "Beridze",
          phone: "+995555123456",
          registration_completed_at: "2026-08-01T00:00:00Z",
          status: "profile_completed",
        }),
    });
    const res = await findAdminCandidateAction("555-12-34-56");
    expect(res).toMatchObject({ ok: true, candidate: { id: userId, phone: "+995555123456" } });
    expect(s.tableCalls()).toHaveLength(1);
    expect(s.tableCalls()[0]!.name).toBe("admin_members");
    expect(s.tableCalls()[0]!.chain).toContainEqual({
      method: "in",
      args: ["phone", ["+995555123456", "995555123456"]],
    });
  });
});
