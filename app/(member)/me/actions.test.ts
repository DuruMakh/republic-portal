import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_MESSAGES, GENERIC_FUNNEL_ERROR } from "@/lib/funnel";

const mocks = vi.hoisted(() => ({ eq: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({ update: () => ({ eq: mocks.eq }) }),
  })),
}));

import { updateProfileAction, updateRegisteredNameAction } from "./actions";

const profile = {
  firstName: "ახალი",
  lastName: "სახელი",
  regionId: 1,
  cityId: 2,
  employment: "სტუდენტი",
};

describe("profile name edits of an approved delegate (security audit M2)", () => {
  beforeEach(() => {
    mocks.eq.mockResolvedValue({ error: { message: "name_locked", code: "P0001" } });
  });

  it("explains the lock on the full profile form", async () => {
    await expect(updateProfileAction(profile)).resolves.toEqual({
      ok: false,
      error: ERROR_MESSAGES["name_locked"],
    });
    expect(ERROR_MESSAGES["name_locked"]).toBeDefined();
  });

  it("explains the lock on the registered-name form", async () => {
    await expect(
      updateRegisteredNameAction({ firstName: "ახალი", lastName: "სახელი" }),
    ).resolves.toEqual({ ok: false, error: ERROR_MESSAGES["name_locked"] });
  });

  it("keeps an unrecognised database failure generic", async () => {
    mocks.eq.mockResolvedValue({ error: { message: "connection reset", code: "08006" } });
    await expect(updateProfileAction(profile)).resolves.toEqual({
      ok: false,
      error: GENERIC_FUNNEL_ERROR,
    });
  });

  it("still maps the city/region mismatch", async () => {
    mocks.eq.mockResolvedValue({ error: { message: "fk", code: "23503" } });
    await expect(updateProfileAction(profile)).resolves.toEqual({
      ok: false,
      error: ERROR_MESSAGES["invalid_city"],
    });
  });
});
