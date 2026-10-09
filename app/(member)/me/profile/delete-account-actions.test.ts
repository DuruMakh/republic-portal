// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ACCOUNT_DELETION_CONFIRM_WORD } from "@/lib/account-deletion";
import { ACCOUNT_DELETE_CONFIRM_MISMATCH } from "@/lib/account-deletion-copy";
import { mapFunnelError } from "@/lib/funnel";
import {
  adminTestHarness,
  fakeAdminClient,
  ok,
  raised,
} from "../../../(admin)/admin/_test-utils/fake-supabase";

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  createAdminClient: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: mocks.createServerSupabase }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

const { deleteMyAccountAction } = await import("./delete-account-actions");
const session = adminTestHarness(mocks);

const PHOTO_URL = "https://x.supabase.co/storage/v1/object/public/delegate-photos/p-1.jpg";

describe("deleteMyAccountAction", () => {
  it("refuses a wrong word before any database call", async () => {
    const s = session();
    const result = await deleteMyAccountAction({ confirm: "delete" });
    expect(result).toEqual({ ok: false, error: ACCOUNT_DELETE_CONFIRM_MISMATCH });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    expect(s.calls).toHaveLength(0);
  });

  it("deletes through the caller's own session, removes the photo, signs out, redirects", async () => {
    const storage = fakeAdminClient();
    mocks.createAdminClient.mockReturnValue(storage.client);
    const s = session({
      rpc: (name) => (name === "delete_my_account" ? ok({ photoUrl: PHOTO_URL }) : undefined),
    });
    await expect(deleteMyAccountAction({ confirm: ACCOUNT_DELETION_CONFIRM_WORD })).rejects.toThrow(
      "REDIRECT /account-deleted",
    );
    expect(s.rpcCalls()).toHaveLength(1);
    expect(s.rpcCalls()[0]).toMatchObject({
      name: "delete_my_account",
      args: { p_confirm: ACCOUNT_DELETION_CONFIRM_WORD },
    });
    expect(storage.storageCalls).toContainEqual({
      bucket: "delegate-photos",
      method: "remove",
      args: [["p-1.jpg"]],
    });
    expect(s.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("sends the trimmed word, because the database compares it exactly", async () => {
    const s = session({ rpc: () => ok({ photoUrl: null }) });
    await expect(
      deleteMyAccountAction({ confirm: `  ${ACCOUNT_DELETION_CONFIRM_WORD} ` }),
    ).rejects.toThrow("REDIRECT /account-deleted");
    expect(s.rpcCalls()[0]?.args).toEqual({ p_confirm: ACCOUNT_DELETION_CONFIRM_WORD });
  });

  it("does not touch Storage when the member had no photo", async () => {
    const storage = fakeAdminClient();
    mocks.createAdminClient.mockReturnValue(storage.client);
    const s = session({ rpc: () => ok({ photoUrl: null }) });
    await expect(deleteMyAccountAction({ confirm: ACCOUNT_DELETION_CONFIRM_WORD })).rejects.toThrow(
      "REDIRECT /account-deleted",
    );
    expect(storage.storageCalls).toHaveLength(0);
    expect(s.signOut).toHaveBeenCalled();
  });

  it("still signs out and redirects when the photo removal fails (the account is already gone)", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createAdminClient.mockReturnValue({
      storage: {
        from: () => ({ remove: async () => ({ data: null, error: { message: "bucket down" } }) }),
      },
    });
    const s = session({ rpc: () => ok({ photoUrl: PHOTO_URL }) });
    await expect(deleteMyAccountAction({ confirm: ACCOUNT_DELETION_CONFIRM_WORD })).rejects.toThrow(
      "REDIRECT /account-deleted",
    );
    expect(logged).toHaveBeenCalled();
    expect(s.signOut).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("shows the mapped Georgian message when the database refuses, and keeps the session", async () => {
    const s = session({ rpc: () => raised("staff_account") });
    expect(await deleteMyAccountAction({ confirm: ACCOUNT_DELETION_CONFIRM_WORD })).toEqual({
      ok: false,
      error: mapFunnelError("staff_account"),
    });
    expect(s.signOut).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
