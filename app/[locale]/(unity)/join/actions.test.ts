import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRIVACY_CONSENT_REQUIRED_MESSAGE, PRIVACY_POLICY_VERSION } from "@/lib/privacy";

const mocks = vi.hoisted(() => ({ createServerSupabase: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: mocks.createServerSupabase }));

import { registerAction } from "./actions";

const NAMES = { firstName: "ნინო", lastName: "ბერიძე" };

beforeEach(() => {
  mocks.createServerSupabase.mockReset();
  mocks.rpc.mockReset();
  mocks.createServerSupabase.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { exists: true }, error: null });
});

describe("registerAction (legacy phone mode)", () => {
  it("sends the current policy version with a consented registration", async () => {
    await registerAction({ ...NAMES, privacyConsent: true });
    expect(mocks.rpc).toHaveBeenCalledWith("register", {
      p_first_name: "ნინო",
      p_last_name: "ბერიძე",
      p_ref_code: null,
      p_privacy_version: PRIVACY_POLICY_VERSION,
    });
  });

  it("refuses an unconsented registration before opening Supabase", async () => {
    await expect(registerAction(NAMES)).resolves.toEqual({
      ok: false,
      error: PRIVACY_CONSENT_REQUIRED_MESSAGE,
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("maps the database refusal to the consent message", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "privacy_consent_required" } });
    await expect(registerAction({ ...NAMES, privacyConsent: true })).resolves.toEqual({
      ok: false,
      error: PRIVACY_CONSENT_REQUIRED_MESSAGE,
    });
  });
});
