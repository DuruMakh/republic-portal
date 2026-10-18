import { beforeEach, describe, expect, it, vi } from "vitest";

const { invalidate } = vi.hoisted(() => ({ invalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: invalidate }));
import { revalidatePath } from "./revalidate";

beforeEach(() => invalidate.mockClear());

describe("refreshing localized content", () => {
  it("invalidates both rendered languages when a story is changed", () => {
    revalidatePath("/news/story");
    expect(invalidate.mock.calls.map(([path]) => path)).toEqual([
      "/news/story",
      "/ka/news/story",
      "/en/news/story",
    ]);
  });
  it("refreshes both account layouts after a membership change", () => {
    revalidatePath("/me", "layout");
    expect(invalidate).toHaveBeenCalledWith("/ka/me", "layout");
    expect(invalidate).toHaveBeenCalledWith("/en/me", "layout");
  });
  it("keeps administrative refreshes within Georgian", () => {
    revalidatePath("/admin/members");
    expect(invalidate.mock.calls.map(([path]) => path)).toEqual([
      "/admin/members",
      "/ka/admin/members",
    ]);
  });
});
