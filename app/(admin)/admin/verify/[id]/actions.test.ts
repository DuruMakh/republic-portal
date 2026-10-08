// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { delegateProfileSchema } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import {
  adminTestHarness,
  fakeAdminClient,
  ok,
  raised,
  type FakeHandlers,
} from "../../_test-utils/fake-supabase";

/**
 * The delegate-photo upload is a service-role path (spec §6). CLAUDE.md forbids
 * the service-role key on any path reachable without a server-side role check,
 * so the verifier/super_admin precheck must come BEFORE createAdminClient() —
 * a refused caller must never cause a privileged client to exist, let alone an
 * upload. The profile itself lands only through the re-checking, audited
 * admin_update_delegate_profile RPC.
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

const { updateDelegateProfileAction, updateDelegateNameAction } = await import("./actions");

const delegateId = "77777777-7777-4777-8777-777777777777";
const OLD_URL = "https://cdn.test/storage/v1/object/public/delegate-photos/old.jpg";

function form(fields: { delegateId?: string; bio?: string; photo?: File }): FormData {
  const fd = new FormData();
  if (fields.delegateId !== undefined) fd.set("delegateId", fields.delegateId);
  if (fields.bio !== undefined) fd.set("bio", fields.bio);
  if (fields.photo) fd.set("photo", fields.photo);
  return fd;
}
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff])], "p.jpg", { type: "image/jpeg" });

/** the service-role decoy is a storage fake, re-created before every test */
let admin = fakeAdminClient();
const session = adminTestHarness(mocks, () => (admin = fakeAdminClient()).client);
function approvedTarget(rpc: FakeHandlers["rpc"] = () => ok()) {
  return session({
    from: () => ok({ photo_url: OLD_URL, slug: "nino-beridze", status: "approved" }),
    rpc,
  });
}

describe("updateDelegateProfileAction", () => {
  it("rejects a malformed form before reading roles or creating any client", async () => {
    const res = await updateDelegateProfileAction(form({ delegateId: "x", photo: jpeg() }));
    expect(res).toEqual({
      ok: false,
      error:
        delegateProfileSchema.safeParse({ delegateId: "x", bio: "" }).error?.issues[0]?.message ??
        GENERIC_FUNNEL_ERROR,
    });
    expect(mocks.getAdminRoles).not.toHaveBeenCalled();
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it.each([[[]], [["finance", "editor"]]])(
    "refuses roles %j before ANY client exists — no service role, no upload",
    async (roles) => {
      mocks.getAdminRoles.mockResolvedValue(roles);
      approvedTarget();
      await expect(
        updateDelegateProfileAction(form({ delegateId, bio: "bio", photo: jpeg() })),
      ).resolves.toEqual({ ok: false, error: mapFunnelError("missing_role") });
      expect(mocks.createServerSupabase).not.toHaveBeenCalled();
      expect(mocks.createAdminClient).not.toHaveBeenCalled();
      expect(admin.storageCalls).toEqual([]);
    },
  );

  it("never uploads for a delegate that is not approved", async () => {
    mocks.getAdminRoles.mockResolvedValue(["verifier"]);
    const s = session({ from: () => ok({ photo_url: null, slug: null, status: "pending" }) });
    await expect(updateDelegateProfileAction(form({ delegateId, photo: jpeg() }))).resolves.toEqual(
      { ok: false, error: mapFunnelError("invalid_target") },
    );
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(s.rpcCalls()).toEqual([]);
  });

  it.each([[["verifier"]], [["super_admin"]]])(
    "%j: uploads with the service role, then saves only through the audited RPC",
    async (roles) => {
      mocks.getAdminRoles.mockResolvedValue(roles);
      const s = approvedTarget();
      await expect(
        updateDelegateProfileAction(form({ delegateId, bio: "  hello  ", photo: jpeg() })),
      ).resolves.toEqual({ ok: true });
      const upload = admin.storageCalls.find((c) => c.method === "upload");
      expect(upload?.bucket).toBe("delegate-photos");
      expect(String(upload?.args[0])).toMatch(new RegExp(`^${delegateId}-\\d+\\.jpg$`));
      expect(s.rpcCalls()).toEqual([
        {
          kind: "rpc",
          name: "admin_update_delegate_profile",
          args: {
            p_delegate_id: delegateId,
            p_bio: "hello",
            p_photo_url: `https://cdn.test/delegate-photos/${String(upload?.args[0])}`,
          },
          chain: [],
        },
      ]);
      // the old object is cleaned up only after the row points at the new one
      expect(admin.storageCalls.at(-1)).toEqual({
        bucket: "delegate-photos",
        method: "remove",
        args: [["old.jpg"]],
      });
    },
  );

  it("when the database refuses the save, the just-uploaded file is removed and nothing is revalidated", async () => {
    mocks.getAdminRoles.mockResolvedValue(["verifier"]);
    approvedTarget(() => raised("missing_role"));
    await expect(updateDelegateProfileAction(form({ delegateId, photo: jpeg() }))).resolves.toEqual(
      { ok: false, error: mapFunnelError("missing_role") },
    );
    const uploaded = String(admin.storageCalls.find((c) => c.method === "upload")?.args[0]);
    expect(admin.storageCalls.at(-1)).toEqual({
      bucket: "delegate-photos",
      method: "remove",
      args: [[uploaded]],
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateDelegateNameAction (security audit M2)", () => {
  const input = { delegateId, firstName: "  ნინო ", lastName: " ბერიძე  " };

  it("rejects a malformed request before reading roles", async () => {
    await expect(
      updateDelegateNameAction({ delegateId: "x", firstName: "", lastName: "" }),
    ).resolves.toMatchObject({ ok: false });
    expect(mocks.getAdminRoles).not.toHaveBeenCalled();
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it.each([[[]], [["finance", "editor"]]])(
    "refuses roles %j before any client exists",
    async (roles) => {
      mocks.getAdminRoles.mockResolvedValue(roles);
      await expect(updateDelegateNameAction(input)).resolves.toEqual({
        ok: false,
        error: mapFunnelError("missing_role"),
      });
      expect(mocks.createServerSupabase).not.toHaveBeenCalled();
      expect(mocks.createAdminClient).not.toHaveBeenCalled();
    },
  );

  it("renames only through the audited RPC, trimmed, then refreshes both pages", async () => {
    mocks.getAdminRoles.mockResolvedValue(["verifier"]);
    const s = session({ rpc: () => ok(), from: () => ok({ slug: "nino-beridze" }) });
    await expect(updateDelegateNameAction(input)).resolves.toEqual({ ok: true });
    expect(s.rpcCalls()).toEqual([
      {
        kind: "rpc",
        name: "admin_update_delegate_name",
        args: { p_delegate_id: delegateId, p_first_name: "ნინო", p_last_name: "ბერიძე" },
        chain: [],
      },
    ]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/verify/${delegateId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/delegates/nino-beridze");
  });

  it("maps a database refusal and revalidates nothing", async () => {
    mocks.getAdminRoles.mockResolvedValue(["super_admin"]);
    session({ rpc: () => raised("invalid_target") });
    await expect(updateDelegateNameAction(input)).resolves.toEqual({
      ok: false,
      error: mapFunnelError("invalid_target"),
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
