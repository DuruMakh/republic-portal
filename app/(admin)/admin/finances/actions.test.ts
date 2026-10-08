// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordPaymentSchema, voidPaymentSchema } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { adminTestHarness, ok, raised } from "../_test-utils/fake-supabase";

/**
 * Money. Recording and voiding a payment change a member's status and every
 * money figure; both are SECURITY DEFINER RPCs that re-check super_admin/finance
 * and write the audit row in the same transaction (ADR-014; the SQL is pinned in
 * lib/security/schema-guards.test.ts). The actions must validate with zod before
 * any client exists, call the RPC through the caller's own session, never write
 * payments directly, and report a refusal without revalidating as if it worked.
 * The read-side helpers (member lookup, bulk preview) gate on the role app-side
 * before querying. The schemas' own edge cases live in lib/admin-schemas.test.ts;
 * here one or two invalid inputs prove "rejected before any client exists".
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

const {
  confirmBulkAction,
  lookupMemberAction,
  previewBulkAction,
  recordPaymentAction,
  voidPaymentAction,
} = await import("./actions");

const session = adminTestHarness(mocks);
const memberId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  // Tbilisi "today" is 2026-10-08 — the paid-at window is 2026-01-01..today
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T08:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("recordPaymentAction", () => {
  const valid = { memberId, amountGel: 20, paidAt: "2026-10-01", bankReference: "" };

  it.each([
    { label: "a date in the future", input: { ...valid, paidAt: "2026-10-09" } },
    { label: "fractions of a tetri", input: { ...valid, amountGel: 20.005 } },
  ])("rejects $label before creating any Supabase client", async ({ input }) => {
    await expect(recordPaymentAction(input)).resolves.toEqual({
      ok: false,
      error: recordPaymentSchema.safeParse(input).error?.issues[0]?.message ?? GENERIC_FUNNEL_ERROR,
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("surfaces a database refusal and does not revalidate", async () => {
    const s = session({ rpc: () => raised("missing_role") });
    await expect(recordPaymentAction(valid)).resolves.toEqual({
      ok: false,
      error: mapFunnelError("missing_role"),
    });
    expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_record_payment"]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("records through the audited RPC only, with the exact arguments", async () => {
    const s = session({ rpc: () => ok({ months: 1, newStatus: "active_member" }) });
    await expect(recordPaymentAction({ ...valid, bankReference: "  TRX-991  " })).resolves.toEqual({
      ok: true,
      months: 1,
      newStatus: "active_member",
    });
    expect(s.calls).toEqual([
      {
        kind: "rpc",
        name: "admin_record_payment",
        args: {
          p_member_id: memberId,
          p_amount_gel: 20,
          p_paid_at: "2026-10-01",
          p_bank_reference: "TRX-991",
        },
        chain: [],
      },
    ]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/finances");
  });

  it("sends a blank bank reference as null (so the RPC's duplicate backstop applies)", async () => {
    const s = session({ rpc: () => ok({ months: 1, newStatus: "active_member" }) });
    await recordPaymentAction({ memberId, amountGel: 20, paidAt: "2026-10-08" });
    expect(s.rpcCalls()[0]!.args).toMatchObject({ p_bank_reference: null });
  });
});

describe("voidPaymentAction", () => {
  it.each([
    { label: "a payment id sent as a string", paymentId: "42", reason: "duplicate entry" },
    { label: "a two-character reason", paymentId: 42, reason: "ab" },
  ])("rejects $label before creating any Supabase client", async ({ paymentId, reason }) => {
    await expect(voidPaymentAction(paymentId, reason)).resolves.toEqual({
      ok: false,
      error:
        voidPaymentSchema.safeParse({ paymentId, reason }).error?.issues[0]?.message ??
        GENERIC_FUNNEL_ERROR,
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it.each(["missing_role", "already_voided"])(
    "surfaces a database refusal (%s) and does not revalidate",
    async (token) => {
      const s = session({ rpc: () => raised(token) });
      await expect(voidPaymentAction(42, "duplicate entry")).resolves.toEqual({
        ok: false,
        error: mapFunnelError(token),
      });
      expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_void_payment"]);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("voids through the audited RPC only, with the trimmed reason", async () => {
    const s = session({ rpc: () => ok({ newStatus: "profile_completed" }) });
    await expect(voidPaymentAction(42, "  duplicate entry  ")).resolves.toEqual({ ok: true });
    expect(s.calls).toEqual([
      {
        kind: "rpc",
        name: "admin_void_payment",
        args: { p_payment_id: 42, p_reason: "duplicate entry" },
        chain: [],
      },
    ]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/finances");
  });
});

describe("confirmBulkAction", () => {
  const row = { referenceCode: "GR-ABCDEF", amountGel: 20, paidAt: "2026-10-01" };

  it("rejects an empty batch before creating any Supabase client", async () => {
    await expect(confirmBulkAction([])).resolves.toMatchObject({ ok: false, rowIndex: null });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("surfaces a database refusal and does not revalidate", async () => {
    const s = session({ rpc: () => raised("missing_role") });
    await expect(confirmBulkAction([row])).resolves.toEqual({
      ok: false,
      error: mapFunnelError("missing_role"),
      rowIndex: null,
    });
    expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_record_payments_bulk"]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("points at the offending row when the RPC rejects one", async () => {
    session({ rpc: () => raised("bulk_row:3:duplicate") });
    await expect(confirmBulkAction([row])).resolves.toEqual({
      ok: false,
      error: mapFunnelError("duplicate"),
      rowIndex: 3,
    });
  });

  it("records the whole batch in one audited RPC call", async () => {
    const s = session({ rpc: () => ok({ count: 1, totalGel: 20 }) });
    await expect(confirmBulkAction([row])).resolves.toEqual({ ok: true, count: 1, totalGel: 20 });
    expect(s.calls).toEqual([
      { kind: "rpc", name: "admin_record_payments_bulk", args: { p_rows: [row] }, chain: [] },
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/finances");
  });
});

describe.each([
  { name: "lookupMemberAction", call: () => lookupMemberAction("Beridze") },
  { name: "previewBulkAction", call: () => previewBulkAction("GR-ABCDEF 20.00 2026-10-01") },
])("$name — finance/super_admin only, gated before any query", ({ call }) => {
  it.each([[[]], [["verifier", "editor"]]])(
    "refuses roles %j without creating a Supabase client",
    async (roles) => {
      mocks.getAdminRoles.mockResolvedValue(roles);
      await expect(call()).resolves.toEqual({ ok: false, error: mapFunnelError("missing_role") });
      expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    },
  );

  it.each([[["finance"]], [["super_admin"]]])("lets %j through to the query", async (roles) => {
    mocks.getAdminRoles.mockResolvedValue(roles);
    const s = session({ from: () => ok([]) });
    const res = await call();
    expect(res.ok).toBe(true);
    expect(s.tableCalls().length).toBeGreaterThan(0);
  });
});

describe("input validation runs before the role read", () => {
  it("lookupMemberAction rejects a one-character query without reading roles", async () => {
    const res = await lookupMemberAction("a");
    expect(res.ok).toBe(false);
    expect(mocks.getAdminRoles).not.toHaveBeenCalled();
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("previewBulkAction rejects empty text without reading roles", async () => {
    const res = await previewBulkAction("");
    expect(res.ok).toBe(false);
    expect(mocks.getAdminRoles).not.toHaveBeenCalled();
  });
});
