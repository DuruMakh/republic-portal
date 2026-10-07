// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { graceDaysSchema } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { fakeSession, ok, raised } from "../_test-utils/fake-supabase";

/**
 * The grace-days rule recomputes every member's status. admin_update_setting
 * re-checks super_admin and audits settings.update in-DB (ADR-014, pinned in
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

const { updateGraceDaysAction } = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAdminClient.mockReturnValue(fakeSession({ rpc: () => ok() }).client);
});

describe("updateGraceDaysAction", () => {
  it.each([[-1], [366], [1.5], ["7"], [undefined]])(
    "rejects %j before creating any Supabase client",
    async (input) => {
      const expected = graceDaysSchema.safeParse({ graceDays: input });
      await expect(updateGraceDaysAction(input)).resolves.toEqual({
        ok: false,
        error: expected.error?.issues[0]?.message ?? GENERIC_FUNNEL_ERROR,
      });
      expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    },
  );

  it.each(["not_authenticated", "missing_role"])(
    "surfaces the RPC's %s refusal and revalidates nothing",
    async (token) => {
      const s = fakeSession({ rpc: () => raised(token) });
      mocks.createServerSupabase.mockResolvedValue(s.client);
      await expect(updateGraceDaysAction(7)).resolves.toEqual({
        ok: false,
        error: mapFunnelError(token),
      });
      expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_update_setting"]);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
      expect(mocks.createAdminClient).not.toHaveBeenCalled();
    },
  );

  it("updates only the grace-days key, through the audited RPC", async () => {
    const s = fakeSession({ rpc: () => ok() });
    mocks.createServerSupabase.mockResolvedValue(s.client);
    await expect(updateGraceDaysAction(14)).resolves.toEqual({ ok: true });
    expect(s.calls).toEqual([
      {
        kind: "rpc",
        name: "admin_update_setting",
        args: { p_key: "active_grace_days", p_value: 14 },
        chain: [],
      },
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/settings");
  });
});
