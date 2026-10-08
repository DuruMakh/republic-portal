// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { newsFormSchema } from "@/lib/content-schemas";
import { GENERIC_FUNNEL_ERROR, mapFunnelError } from "@/lib/funnel";
import { adminTestHarness, fakeAdminClient, ok, raised } from "../../_test-utils/fake-supabase";

/**
 * News. Every mutation is a SECURITY DEFINER RPC that re-checks super_admin/editor
 * and audits in-DB (ADR-014, pinned in lib/security/schema-guards.test.ts). The
 * cover upload is a service-role path, so its editor/super_admin precheck must
 * come before createAdminClient() (CLAUDE.md forbidden pattern).
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
  deleteNewsAction,
  publishNewsAction,
  saveNewsAction,
  setNewsCoverAction,
  unpublishNewsAction,
} = await import("./actions");

const newsId = "88888888-8888-4888-8888-888888888888";

/** the service-role decoy is a storage fake, re-created before every test */
let admin = fakeAdminClient();
const session = adminTestHarness(mocks, () => (admin = fakeAdminClient()).client);

describe("saveNewsAction", () => {
  const valid = { title: "Title", body: "Body", visibility: "public" };

  it.each([
    { label: "an empty title", input: { ...valid, title: "   " } },
    { label: "an unknown visibility", input: { ...valid, visibility: "everyone" } },
  ])("rejects $label before creating any Supabase client", async ({ input }) => {
    await expect(saveNewsAction(input)).resolves.toEqual({
      ok: false,
      error: newsFormSchema.safeParse(input).error?.issues[0]?.message ?? GENERIC_FUNNEL_ERROR,
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("surfaces a database refusal and does not revalidate", async () => {
    const s = session({ rpc: () => raised("missing_role") });
    await expect(saveNewsAction(valid)).resolves.toEqual({
      ok: false,
      error: mapFunnelError("missing_role"),
    });
    expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_save_news"]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("saves through the audited RPC with the exact arguments", async () => {
    const s = session({ rpc: () => ok(newsId), from: () => ok({ slug: null }) });
    await expect(saveNewsAction({ ...valid, title: "  Title  " })).resolves.toEqual({
      ok: true,
      id: newsId,
    });
    expect(s.rpcCalls()).toEqual([
      {
        kind: "rpc",
        name: "admin_save_news",
        args: { p_id: null, p_title: "Title", p_body: "Body", p_visibility: "public" },
        chain: [],
      },
    ]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});

describe.each([
  { name: "publishNewsAction", action: publishNewsAction, rpc: "admin_publish_news" },
  { name: "unpublishNewsAction", action: unpublishNewsAction, rpc: "admin_unpublish_news" },
  { name: "deleteNewsAction", action: deleteNewsAction, rpc: "admin_delete_news" },
])("$name", ({ action, rpc }) => {
  it("rejects a non-uuid id before creating any client", async () => {
    await expect(action("x")).resolves.toEqual({ ok: false, error: GENERIC_FUNNEL_ERROR });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("surfaces a database refusal and does not revalidate", async () => {
    const s = session({
      from: () => ok({ title: "Title", slug: "title" }),
      rpc: () => raised("missing_role"),
    });
    await expect(action(newsId)).resolves.toEqual({
      ok: false,
      error: mapFunnelError("missing_role"),
    });
    expect(s.rpcCalls().map((c) => c.name)).toEqual([rpc]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("calls the audited RPC with the article id", async () => {
    const s = session({
      from: () => ok({ title: "Title", slug: "title" }),
      rpc: () => ok({ slug: "title" }),
    });
    await expect(action(newsId)).resolves.toEqual({ ok: true });
    expect(s.rpcCalls()).toHaveLength(1);
    expect(s.rpcCalls()[0]).toMatchObject({ name: rpc, args: { p_id: newsId } });
  });
});

describe("setNewsCoverAction — service-role upload", () => {
  const cover = () => new File([new Uint8Array([0x89, 0x50])], "c.png", { type: "image/png" });
  function form(id: string, file?: File): FormData {
    const fd = new FormData();
    fd.set("newsId", id);
    if (file) fd.set("cover", file);
    return fd;
  }

  it("rejects a malformed id before reading roles or creating any client", async () => {
    await expect(setNewsCoverAction(form("x", cover()))).resolves.toEqual({
      ok: false,
      error: GENERIC_FUNNEL_ERROR,
    });
    expect(mocks.getAdminRoles).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it.each([[[]], [["verifier", "finance"]]])(
    "refuses roles %j before ANY client exists — no service role, no upload",
    async (roles) => {
      mocks.getAdminRoles.mockResolvedValue(roles);
      session({ from: () => ok({ image_url: null, slug: null }) });
      await expect(setNewsCoverAction(form(newsId, cover()))).resolves.toEqual({
        ok: false,
        error: mapFunnelError("missing_role"),
      });
      expect(mocks.createServerSupabase).not.toHaveBeenCalled();
      expect(mocks.createAdminClient).not.toHaveBeenCalled();
      expect(admin.storageCalls).toEqual([]);
    },
  );

  it.each([[["editor"]], [["super_admin"]]])(
    "%j: uploads, then sets the image only through the audited RPC",
    async (roles) => {
      mocks.getAdminRoles.mockResolvedValue(roles);
      const s = session({ from: () => ok({ image_url: null, slug: "title" }), rpc: () => ok() });
      await expect(setNewsCoverAction(form(newsId, cover()))).resolves.toEqual({ ok: true });
      const upload = admin.storageCalls.find((c) => c.method === "upload");
      expect(upload?.bucket).toBe("news-images");
      expect(s.rpcCalls()).toEqual([
        {
          kind: "rpc",
          name: "admin_set_news_image",
          args: {
            p_id: newsId,
            p_image_url: `https://cdn.test/news-images/${String(upload?.args[0])}`,
          },
          chain: [],
        },
      ]);
    },
  );

  it("removes the just-uploaded file when the database refuses the save", async () => {
    mocks.getAdminRoles.mockResolvedValue(["editor"]);
    session({ from: () => ok({ image_url: null, slug: null }), rpc: () => raised("missing_role") });
    await expect(setNewsCoverAction(form(newsId, cover()))).resolves.toEqual({
      ok: false,
      error: mapFunnelError("missing_role"),
    });
    const uploaded = String(admin.storageCalls.find((c) => c.method === "upload")?.args[0]);
    expect(admin.storageCalls.at(-1)).toEqual({
      bucket: "news-images",
      method: "remove",
      args: [[uploaded]],
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
