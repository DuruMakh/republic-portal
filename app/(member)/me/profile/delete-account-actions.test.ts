// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_DELETION_CONFIRM_WORD } from "@/lib/account-deletion";
import { ACCOUNT_DELETE_CONFIRM_MISMATCH } from "@/lib/account-deletion-copy";
import { mapFunnelError } from "@/lib/funnel";
import {
  adminTestHarness,
  FAKE_SESSION_USER_ID,
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
const WORD = { confirm: ACCOUNT_DELETION_CONFIRM_WORD };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deleteMyAccountAction — refusals before the erasure", () => {
  it("refuses a wrong word before any database call", async () => {
    const s = session();
    const result = await deleteMyAccountAction({ confirm: "delete" });
    expect(result).toEqual({ ok: false, error: ACCOUNT_DELETE_CONFIRM_MISMATCH });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(s.calls).toHaveLength(0);
  });

  it("asks a caller with no live session to sign in again, without calling the erasure", async () => {
    const s = session({ rpc: () => ok({ photoUrl: PHOTO_URL }) });
    s.getUser.mockResolvedValue({ data: { user: null }, error: { message: "session missing" } });
    expect(await deleteMyAccountAction(WORD)).toEqual({
      ok: false,
      error: mapFunnelError("not_authenticated"),
    });
    expect(s.rpcCalls()).toHaveLength(0);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(s.signOut).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each(["staff_account", "staff_history", "invalid_confirmation"])(
    "shows the mapped Georgian message for %s, keeps the session, never creates the service role",
    async (token) => {
      const s = session({ rpc: () => raised(token) });
      expect(await deleteMyAccountAction(WORD)).toEqual({
        ok: false,
        error: mapFunnelError(token),
      });
      expect(s.signOut).not.toHaveBeenCalled();
      expect(mocks.redirect).not.toHaveBeenCalled();
      expect(mocks.createAdminClient).not.toHaveBeenCalled();
    },
  );
});

describe("deleteMyAccountAction — a completed erasure", () => {
  it("deletes through the caller's own session, sweeps their photos, signs out, redirects", async () => {
    const storage = fakeAdminClient();
    mocks.createAdminClient.mockReturnValue(storage.client);
    const s = session({
      rpc: (name) => (name === "delete_my_account" ? ok({ photoUrl: PHOTO_URL }) : undefined),
    });
    await expect(deleteMyAccountAction(WORD)).rejects.toThrow("REDIRECT /account-deleted");
    expect(s.getUser).toHaveBeenCalled();
    expect(s.rpcCalls()).toHaveLength(1);
    expect(s.rpcCalls()[0]).toMatchObject({
      name: "delete_my_account",
      args: { p_confirm: ACCOUNT_DELETION_CONFIRM_WORD },
    });
    // the sweep is keyed to the session's own user, never to anything the client sent
    expect(storage.storageCalls).toContainEqual({
      bucket: "delegate-photos",
      method: "list",
      args: ["", expect.objectContaining({ search: `${FAKE_SESSION_USER_ID}-` })],
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

  it("sweeps by the member's id even when the row recorded no photo", async () => {
    const storage = fakeAdminClient({ listed: [`${FAKE_SESSION_USER_ID}-1.jpg`] });
    mocks.createAdminClient.mockReturnValue(storage.client);
    const s = session({ rpc: () => ok({ photoUrl: null }) });
    await expect(deleteMyAccountAction(WORD)).rejects.toThrow("REDIRECT /account-deleted");
    expect(storage.storageCalls.at(-1)).toEqual({
      bucket: "delegate-photos",
      method: "remove",
      args: [[`${FAKE_SESSION_USER_ID}-1.jpg`]],
    });
    expect(s.signOut).toHaveBeenCalled();
  });

  it("still signs out and redirects when Storage refuses the removal", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createAdminClient.mockReturnValue(
      fakeAdminClient({ removeError: { message: "bucket down" } }).client,
    );
    const s = session({ rpc: () => ok({ photoUrl: PHOTO_URL }) });
    await expect(deleteMyAccountAction(WORD)).rejects.toThrow("REDIRECT /account-deleted");
    expect(logged).toHaveBeenCalled();
    expect(s.signOut).toHaveBeenCalled();
  });

  it("still signs out and redirects when the service-role client cannot even be created", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error("missing service role key");
    });
    const s = session({ rpc: () => ok({ photoUrl: PHOTO_URL }) });
    await expect(deleteMyAccountAction(WORD)).rejects.toThrow("REDIRECT /account-deleted");
    expect(logged).toHaveBeenCalled();
    expect(s.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("treats invalid_target (the profile is already gone: a double submit) as done", async () => {
    const s = session({ rpc: () => raised("invalid_target") });
    await expect(deleteMyAccountAction(WORD)).rejects.toThrow("REDIRECT /account-deleted");
    expect(s.signOut).toHaveBeenCalledWith({ scope: "local" });
    // the request that did the erasure sweeps the photos; this one has nothing to add
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
