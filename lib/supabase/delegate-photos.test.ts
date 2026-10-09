// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAdminClient } from "@/app/(admin)/admin/_test-utils/fake-supabase";

/**
 * The account-deletion photo sweep (spec 2026-10-08 §5). It runs after the account is already
 * gone, so it must never throw; and it is the only service-role use in account deletion, so
 * what it removes must come from the server: objects named after the person's id (the upload
 * path is `<delegateId>-<timestamp>.<ext>`) and the path the database returned.
 */

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

const { removeDelegatePhotos } = await import("./delegate-photos");

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "11111111-1111-4111-8111-111111111112";
const url = (path: string) =>
  `https://x.supabase.co/storage/v1/object/public/delegate-photos/${path}`;

let logged: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  logged.mockRestore();
});

describe("removeDelegatePhotos", () => {
  it("sweeps every object named after the person, plus the recorded path, once each", async () => {
    const storage = fakeAdminClient({
      listed: [`${ID}-1700000000000.jpg`, `${ID}-1700000000001.png`, `${OTHER}-1.jpg`],
    });
    mocks.createAdminClient.mockReturnValue(storage.client);

    await removeDelegatePhotos(ID, url(`${ID}-1700000000001.png`));

    expect(storage.storageCalls).toEqual([
      {
        bucket: "delegate-photos",
        method: "list",
        args: ["", expect.objectContaining({ search: `${ID}-` })],
      },
      {
        bucket: "delegate-photos",
        method: "remove",
        // another person's object never goes, even if the server's match were loose
        args: [[`${ID}-1700000000000.jpg`, `${ID}-1700000000001.png`]],
      },
    ]);
    expect(logged).not.toHaveBeenCalled();
  });

  it("sweeps by id even when the row recorded no photo (an older upload left behind)", async () => {
    const storage = fakeAdminClient({ listed: [`${ID}-1.jpg`] });
    mocks.createAdminClient.mockReturnValue(storage.client);

    await removeDelegatePhotos(ID, null);

    expect(storage.storageCalls.at(-1)).toEqual({
      bucket: "delegate-photos",
      method: "remove",
      args: [[`${ID}-1.jpg`]],
    });
  });

  it("removes the recorded path the listing did not cover", async () => {
    const storage = fakeAdminClient({ listed: [] });
    mocks.createAdminClient.mockReturnValue(storage.client);

    await removeDelegatePhotos(ID, url("legacy-name.jpg"));

    expect(storage.storageCalls.at(-1)).toEqual({
      bucket: "delegate-photos",
      method: "remove",
      args: [["legacy-name.jpg"]],
    });
  });

  it("makes no remove call when there is nothing to remove", async () => {
    const storage = fakeAdminClient({ listed: [`${OTHER}-1.jpg`] });
    mocks.createAdminClient.mockReturnValue(storage.client);

    await removeDelegatePhotos(ID, null);

    expect(storage.storageCalls.map((c) => c.method)).toEqual(["list"]);
  });

  it("ignores a recorded URL from another bucket", async () => {
    const storage = fakeAdminClient({ listed: [] });
    mocks.createAdminClient.mockReturnValue(storage.client);

    await removeDelegatePhotos(ID, "https://x.test/news-images/a.jpg");

    expect(storage.storageCalls.map((c) => c.method)).toEqual(["list"]);
  });

  it.each(["", "not-a-uuid", `${ID}/..`])(
    "never sweeps with an id that is not a user id (%s), but still removes the recorded path",
    async (badId) => {
      const storage = fakeAdminClient({ listed: [`${ID}-1.jpg`] });
      mocks.createAdminClient.mockReturnValue(storage.client);

      await removeDelegatePhotos(badId, url("p-1.jpg"));

      expect(storage.storageCalls).toEqual([
        { bucket: "delegate-photos", method: "remove", args: [["p-1.jpg"]] },
      ]);
    },
  );

  it("still removes the recorded path when the listing fails, and logs", async () => {
    const storage = fakeAdminClient({ listError: { message: "list down" } });
    mocks.createAdminClient.mockReturnValue(storage.client);

    await removeDelegatePhotos(ID, url(`${ID}-1.jpg`));

    expect(storage.storageCalls.at(-1)).toEqual({
      bucket: "delegate-photos",
      method: "remove",
      args: [[`${ID}-1.jpg`]],
    });
    expect(logged).toHaveBeenCalled();
  });

  it("still removes the recorded path when the listing throws, and logs", async () => {
    const removed: unknown[] = [];
    mocks.createAdminClient.mockReturnValue({
      storage: {
        from: () => ({
          list: async () => {
            throw new Error("socket hang up");
          },
          remove: async (paths: unknown) => {
            removed.push(paths);
            return { data: [], error: null };
          },
        }),
      },
    });

    await expect(removeDelegatePhotos(ID, url(`${ID}-1.jpg`))).resolves.toBeUndefined();

    expect(removed).toEqual([[`${ID}-1.jpg`]]);
    expect(logged).toHaveBeenCalled();
  });

  it("logs and resolves when Storage refuses the removal", async () => {
    const storage = fakeAdminClient({
      listed: [`${ID}-1.jpg`],
      removeError: { message: "bucket down" },
    });
    mocks.createAdminClient.mockReturnValue(storage.client);

    await expect(removeDelegatePhotos(ID, null)).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();
  });

  it("logs and resolves when the removal throws", async () => {
    mocks.createAdminClient.mockReturnValue({
      storage: {
        from: () => ({
          list: async () => ({ data: [{ name: `${ID}-1.jpg` }], error: null }),
          remove: async () => {
            throw new Error("socket hang up");
          },
        }),
      },
    });

    await expect(removeDelegatePhotos(ID, null)).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();
  });

  it("logs and resolves when the service-role client cannot even be created", async () => {
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error("missing service role key");
    });

    await expect(removeDelegatePhotos(ID, url(`${ID}-1.jpg`))).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();
  });
});
