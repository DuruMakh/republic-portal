import { beforeEach, describe, expect, it, vi } from "vitest";
import { DUPLICATE_PERSONAL_ID_MESSAGE, ERROR_MESSAGES } from "@/lib/funnel";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => ({ rpc: mocks.rpc })),
}));

import { saveMembershipProfileAction } from "./actions";

const input = {
  personalId: "01010101010",
  birthDate: "1990-05-20",
  regionId: 1,
  cityId: 2,
  employment: "სტუდენტი",
  delegateId: null,
};

describe("saveMembershipProfileAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps a raised duplicate to the inline personal-ID message", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "duplicate_personal_id" } });
    await expect(saveMembershipProfileAction(input)).resolves.toEqual({
      ok: false,
      error: DUPLICATE_PERSONAL_ID_MESSAGE,
    });
  });

  it("maps a RETURNED duplicate the same way, never as a cabinet state (audit H1)", async () => {
    mocks.rpc.mockResolvedValue({ data: { error: "duplicate_personal_id" }, error: null });
    await expect(saveMembershipProfileAction(input)).resolves.toEqual({
      ok: false,
      error: DUPLICATE_PERSONAL_ID_MESSAGE,
    });
  });

  it("explains the cap on personal-ID tries and points to support", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "personal_id_attempts_exceeded" },
    });
    expect(ERROR_MESSAGES["personal_id_attempts_exceeded"]).toBeDefined();
    await expect(saveMembershipProfileAction(input)).resolves.toEqual({
      ok: false,
      error: ERROR_MESSAGES["personal_id_attempts_exceeded"],
    });
  });

  it("never mistakes a cabinet state for a refusal, whatever else it carries", async () => {
    const state = { exists: true, standing: "supporter", error: "unrelated" };
    mocks.rpc.mockResolvedValue({ data: state, error: null });
    await expect(saveMembershipProfileAction(input)).resolves.toEqual({ ok: true, state });
  });

  it("passes a real cabinet state through", async () => {
    const state = { exists: true, standing: "supporter" };
    mocks.rpc.mockResolvedValue({ data: state, error: null });
    await expect(saveMembershipProfileAction(input)).resolves.toEqual({ ok: true, state });
  });
});
