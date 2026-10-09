// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_DELETE_NAME_MISMATCH,
  ADMIN_DELETE_REASON_LENGTH,
} from "@/lib/account-deletion-copy";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { adminTestHarness, fakeAdminClient, ok, raised } from "../_test-utils/fake-supabase";

/**
 * Admin deletion on request (spec 2026-10-08 §3.4). Authorization is the RPC's:
 * admin_delete_member checks the session, super_admin, the reason, not-self and staff, and
 * writes the member.delete audit row itself (ADR-014, pinned in lib/security/schema-guards.test.ts).
 * What the ACTION must guarantee: zod rejects garbage before any client exists; the typed name
 * is a UX guard that stops before the database; the call goes through the caller's own session
 * (never the service role, which would bypass auth.uid()); the service role touches Storage
 * alone, best effort, and can never turn a completed deletion into an error.
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

const { deleteMemberAction } = await import("./delete-member-actions");

const session = adminTestHarness(mocks);
const userId = "11111111-1111-4111-8111-111111111111";
const REASON = "member asked by email";
const NAME = "Nino Beridze";
const PHOTO_URL = "https://x.supabase.co/storage/v1/object/public/delegate-photos/p-1.jpg";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deleteMemberAction — input is checked before any database call", () => {
  it.each([
    {
      label: "a non-uuid user id",
      args: ["not-a-uuid", REASON, NAME, NAME],
      error: GENERIC_FUNNEL_ERROR,
    },
    {
      label: "a user id that is not a string",
      args: [42, REASON, NAME, NAME],
      error: GENERIC_FUNNEL_ERROR,
    },
    {
      label: "a reason that is not a string",
      args: [userId, undefined, NAME, NAME],
      error: GENERIC_FUNNEL_ERROR,
    },
    {
      label: "a typed name that is not a string",
      args: [userId, REASON, 7, NAME],
      error: GENERIC_FUNNEL_ERROR,
    },
    {
      label: "a reason that is too short",
      args: [userId, "abcd", NAME, NAME],
      error: ADMIN_DELETE_REASON_LENGTH,
    },
    {
      label: "a reason of only spaces",
      args: [userId, "      ", NAME, NAME],
      error: ADMIN_DELETE_REASON_LENGTH,
    },
    {
      label: "a reason over 300 characters",
      args: [userId, "x".repeat(301), NAME, NAME],
      error: ADMIN_DELETE_REASON_LENGTH,
    },
    {
      label: "no typed name",
      args: [userId, REASON, "  ", NAME],
      error: ADMIN_DELETE_NAME_MISMATCH,
    },
    {
      label: "an expected name that is not a string",
      args: [userId, REASON, NAME, undefined],
      error: GENERIC_FUNNEL_ERROR,
    },
  ])("rejects $label", async ({ args, error }) => {
    const s = session();
    const [id, reason, typed, expected] = args;
    await expect(deleteMemberAction(id, reason, typed, expected)).resolves.toEqual({
      ok: false,
      error,
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(s.calls).toHaveLength(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteMemberAction — the typed name must be the member's name", () => {
  it.each([
    { label: "a different name", typed: "Nino Beridzee" },
    { label: "the same name in another case", typed: "nino beridze" },
    { label: "only the first name", typed: "Nino" },
  ])("refuses $label with zero database calls", async ({ typed }) => {
    const s = session();
    await expect(deleteMemberAction(userId, REASON, typed, NAME)).resolves.toEqual({
      ok: false,
      error: ADMIN_DELETE_NAME_MISMATCH,
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(s.calls).toHaveLength(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("never accepts a typed name against an empty expected name", async () => {
    const s = session();
    await expect(deleteMemberAction(userId, REASON, NAME, "   ")).resolves.toEqual({
      ok: false,
      error: ADMIN_DELETE_NAME_MISMATCH,
    });
    expect(s.calls).toHaveLength(0);
  });

  it("compares trimmed on both sides, and sends the trimmed reason", async () => {
    const s = session({ rpc: () => ok({ photoUrl: null }) });
    await expect(
      deleteMemberAction(userId, `  ${REASON}  `, `  ${NAME} `, ` ${NAME}  `),
    ).resolves.toEqual({ ok: true });
    expect(s.rpcCalls()).toHaveLength(1);
    expect(s.rpcCalls()[0]?.args).toEqual({ p_user_id: userId, p_reason: REASON });
  });
});

describe("deleteMemberAction — a valid request", () => {
  it("makes exactly the one audited RPC call on the caller's session, then removes the photo", async () => {
    const storage = fakeAdminClient();
    mocks.createAdminClient.mockReturnValue(storage.client);
    const s = session({
      rpc: (name) => (name === "admin_delete_member" ? ok({ photoUrl: PHOTO_URL }) : undefined),
    });
    await expect(deleteMemberAction(userId, REASON, NAME, NAME)).resolves.toEqual({ ok: true });
    // no direct table write: the erasure and its member.delete audit row happen only inside
    // the RPC, in one transaction (ADR-014)
    expect(s.calls).toEqual([
      {
        kind: "rpc",
        name: "admin_delete_member",
        args: { p_user_id: userId, p_reason: REASON },
        chain: [],
      },
    ]);
    // the service role touches Storage alone, for the path the database returned
    expect(storage.storageCalls).toEqual([
      { bucket: "delegate-photos", method: "remove", args: [["p-1.jpg"]] },
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/members");
  });

  it("does not create a service-role client when the member had no photo", async () => {
    const s = session({ rpc: () => ok({ photoUrl: null }) });
    await expect(deleteMemberAction(userId, REASON, NAME, NAME)).resolves.toEqual({ ok: true });
    expect(s.rpcCalls()).toHaveLength(1);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/members");
  });

  it.each([
    { label: "an empty result", data: null },
    { label: "a result without a photo", data: {} },
    { label: "a photo url that is not a string", data: { photoUrl: 7 } },
    {
      label: "a photo url from another bucket",
      data: { photoUrl: "https://x.test/news-images/a.jpg" },
    },
  ])("treats $label as nothing to remove", async ({ data }) => {
    session({ rpc: () => ok(data) });
    await expect(deleteMemberAction(userId, REASON, NAME, NAME)).resolves.toEqual({ ok: true });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/members");
  });
});

describe("deleteMemberAction — a completed deletion is never reported as a failure", () => {
  it("logs and still succeeds when Storage reports an error", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createAdminClient.mockReturnValue({
      storage: {
        from: () => ({ remove: async () => ({ data: null, error: { message: "bucket down" } }) }),
      },
    });
    session({ rpc: () => ok({ photoUrl: PHOTO_URL }) });
    await expect(deleteMemberAction(userId, REASON, NAME, NAME)).resolves.toEqual({ ok: true });
    expect(logged).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/members");
  });

  it("logs and still succeeds when the Storage call throws", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createAdminClient.mockReturnValue({
      storage: {
        from: () => ({
          remove: async () => {
            throw new Error("socket hang up");
          },
        }),
      },
    });
    session({ rpc: () => ok({ photoUrl: PHOTO_URL }) });
    await expect(deleteMemberAction(userId, REASON, NAME, NAME)).resolves.toEqual({ ok: true });
    expect(logged).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/members");
  });

  it("logs and still succeeds when the service-role client cannot even be created", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error("missing service role key");
    });
    session({ rpc: () => ok({ photoUrl: PHOTO_URL }) });
    await expect(deleteMemberAction(userId, REASON, NAME, NAME)).resolves.toEqual({ ok: true });
    expect(logged).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/members");
  });
});

describe("deleteMemberAction — database refusals", () => {
  it.each([
    "staff_history",
    "staff_account",
    "cannot_delete_self",
    "invalid_reason",
    "missing_role",
  ])(
    "maps %s to its Georgian message, touches no Storage and revalidates nothing",
    async (token) => {
      const s = session({ rpc: () => raised(token) });
      await expect(deleteMemberAction(userId, REASON, NAME, NAME)).resolves.toEqual({
        ok: false,
        error: mapFunnelError(token),
      });
      expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_delete_member"]);
      expect(mocks.createAdminClient).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("gives the staff refusals their own messages, not the generic one", () => {
    expect(mapFunnelError("staff_history")).not.toBe(GENERIC_FUNNEL_ERROR);
    expect(mapFunnelError("staff_account")).not.toBe(GENERIC_FUNNEL_ERROR);
    expect(mapFunnelError("cannot_delete_self")).not.toBe(GENERIC_FUNNEL_ERROR);
  });
});
