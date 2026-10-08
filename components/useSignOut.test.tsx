import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: mocks.signOut } }),
}));

import { useSignOut } from "./useSignOut";

describe("useSignOut (security audit M3)", () => {
  const deleted: string[] = [];

  beforeEach(() => {
    deleted.length = 0;
    mocks.signOut.mockResolvedValue({ error: null });
    vi.stubGlobal("caches", {
      keys: vi.fn(async () => ["serwist-precache-v2-https://site.test/", "cross-origin", "pages"]),
      delete: vi.fn(async (name: string) => {
        deleted.push(name);
        return true;
      }),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("ends the session, empties the runtime caches, keeps the offline shell", async () => {
    const { result } = renderHook(() => useSignOut());
    await result.current();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(deleted).toEqual(["cross-origin", "pages"]);
    expect(mocks.push).toHaveBeenCalledWith("/");
  });

  it("still signs out and leaves when the cache API fails", async () => {
    vi.stubGlobal("caches", {
      keys: vi.fn(async () => {
        throw new Error("blocked");
      }),
      delete: vi.fn(),
    });
    const { result } = renderHook(() => useSignOut());
    await result.current();
    expect(mocks.push).toHaveBeenCalledWith("/");
  });
});
