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
    {
      token: "not_authenticated",
      error: { code: "P0001", message: "not_authenticated", details: null, hint: null },
      stableCode: "not_authenticated",
      expected: PHONE_VERIFICATION_MESSAGES.not_authenticated,
    },
    {
      token: "google_required",
      error: { code: "P0001", message: "google_required", details: null, hint: null },
      stableCode: "google_required",
      expected: "რეგისტრაციისთვის გამოიყენე Google-ით შესვლა.",
    },
    {
      token: "phone_required",
      error: { code: "P0001", message: "phone_required", details: null, hint: null },
      stableCode: "phone_required",
      expected: "რეგისტრაციისთვის საჭიროა დადასტურებული მობილურის ნომერი.",
    },
  ])(
    "maps exact P0001 exception $token to stable code $stableCode",
    async ({ error, stableCode, expected }) => {
      mocks.rpc.mockResolvedValue({ data: null, error });

      await expect(registerGoogleAction(VALID_INPUT)).resolves.toEqual({
        ok: false,
        code: stableCode,
        error: expected,
      });
    },
  );

  it.each([
    [
      "wrong PostgreSQL code",
      { code: "XX000", message: "phone_required", details: null, hint: null },
    ],
    [
      "message containing the token",
      {
        code: "P0001",
        message: "column phone_required is unavailable",
        details: null,
        hint: null,
      },
    ],
    [
      "extended token",
      { code: "P0001", message: "phone_required_extra", details: null, hint: null },
    ],
    [
      "whitespace variant",
      { code: "P0001", message: " phone_required ", details: null, hint: null },
    ],
    ["missing code", { message: "phone_required", details: null, hint: null }],
    [
      "token only in details and hint",
      {
        code: "P0001",
        message: "database unavailable",
        details: "phone_required",
        hint: "phone_required",
      },
    ],
    [
      "non-contract phone_in_use token",
      { code: "P0001", message: "phone_in_use", details: null, hint: null },
    ],
  ])("fails closed for %s", async (_label, error) => {
    mocks.rpc.mockResolvedValue({ data: null, error });

    await expect(registerGoogleAction(VALID_INPUT)).resolves.toEqual({
      ok: false,
      code: "service_unavailable",
      error: GENERIC_FUNNEL_ERROR,
    });
  });
});
