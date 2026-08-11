import { beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { PHONE_VERIFICATION_MESSAGES } from "@/lib/phone-verification/contracts";

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  createAdminClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: mocks.createServerSupabase,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { registerGoogleAction } from "./google-actions";

const VALID_INPUT = { firstName: "ნინო", lastName: "ბერიძე", refCode: "D00101" };

beforeEach(() => {
  mocks.createServerSupabase.mockReset();
  mocks.createAdminClient.mockReset();
  mocks.rpc.mockReset();
  mocks.createServerSupabase.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { exists: false }, error: null });
});

describe("registerGoogleAction", () => {
  it("validates the existing registration schema before opening Supabase", async () => {
    await expect(
      registerGoogleAction({ firstName: "", lastName: "ბერიძე", refCode: "bad ref" }),
    ).resolves.toEqual({ ok: false, code: "invalid_input", error: "შეავსე ეს ველი" });

    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls only register_google with validated names and referral", async () => {
    await registerGoogleAction(VALID_INPUT);

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("register_google", {
      p_first_name: "ნინო",
      p_last_name: "ბერიძე",
      p_ref_code: "D00101",
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it.each([
    ["P0001: google_required", "google_required", "რეგისტრაციისთვის გამოიყენე Google-ით შესვლა."],
    [
      "P0001: phone_required",
      "phone_required",
      "რეგისტრაციისთვის საჭიროა დადასტურებული მობილურის ნომერი.",
    ],
    ["P0001: phone_in_use", "phone_in_use", PHONE_VERIFICATION_MESSAGES.phone_in_use],
    ["database unavailable", "service_unavailable", GENERIC_FUNNEL_ERROR],
  ])(
    "maps %s to stable code %s without leaking the raw database failure",
    async (raw, code, expected) => {
      mocks.rpc.mockResolvedValue({ data: null, error: { message: raw } });

      await expect(registerGoogleAction(VALID_INPUT)).resolves.toEqual({
        ok: false,
        code,
        error: expected,
      });
    },
  );
});
