import { describe, expect, it } from "vitest";
import {
  canAccess,
  deriveFunnelStep,
  funnelRoute,
  GENERIC_FUNNEL_ERROR,
  isReferenceCode,
  isReferralCodeCandidate,
  mapFunnelError,
  TIERS,
  type FunnelState,
} from "./funnel";

function state(overrides: Partial<FunnelState>): FunnelState {
  return {
    exists: true,
    role: "member",
    firstName: "ნინო",
    lastName: "ბერიძე",
    personalIdSet: false,
    birthDate: null,
    regionId: null,
    cityId: null,
    employment: null,
    tier: null,
    referenceCode: null,
    completed: false,
    delegateStatus: null,
    referral: null,
    chosenDelegate: null,
    membershipExists: false,
    ...overrides,
  };
}

describe("deriveFunnelStep", () => {
  it("no state or no profile → step-1", () => {
    expect(deriveFunnelStep(null)).toBe("step-1");
    expect(deriveFunnelStep(state({ exists: false }))).toBe("step-1");
  });
  it("profile without personal ID → step-2", () => {
    expect(deriveFunnelStep(state({}))).toBe("step-2");
  });
  it("personal ID saved but not completed → step-3", () => {
    expect(deriveFunnelStep(state({ personalIdSet: true }))).toBe("step-3");
  });
  it("completed member → done; completed delegate → pending", () => {
    expect(deriveFunnelStep(state({ personalIdSet: true, completed: true }))).toBe("done");
    expect(
      deriveFunnelStep(
        state({
          role: "delegate",
          personalIdSet: true,
          completed: true,
          delegateStatus: "pending",
        }),
      ),
    ).toBe("pending");
  });
  it("legacy active_member without funnel data counts as completed (spec §3.8)", () => {
    // funnel_state() sets completed=true for status='active_member'; lib trusts the flag
    expect(deriveFunnelStep(state({ personalIdSet: true, completed: true, tier: null }))).toBe(
      "done",
    );
  });
});

describe("funnelRoute", () => {
  it("maps every step to its route", () => {
    expect(funnelRoute("step-1")).toBe("/join/step-1");
    expect(funnelRoute("step-2")).toBe("/join/step-2");
    expect(funnelRoute("step-3")).toBe("/join/step-3");
    expect(funnelRoute("done")).toBe("/join/done");
    expect(funnelRoute("pending")).toBe("/join/pending");
  });
});

describe("canAccess", () => {
  it("current step is always accessible", () => {
    expect(canAccess("step-1", null)).toBe(true);
    expect(canAccess("step-2", state({}))).toBe(true);
  });
  it("step-2 stays editable from step-3 (back navigation)", () => {
    expect(canAccess("step-2", state({ personalIdSet: true }))).toBe(true);
  });
  it("everything else redirects", () => {
    expect(canAccess("step-3", state({}))).toBe(false);
    expect(canAccess("done", state({ personalIdSet: true }))).toBe(false);
    expect(canAccess("step-2", state({ personalIdSet: true, completed: true }))).toBe(false);
  });
});

describe("code formats", () => {
  it("accepts valid reference codes", () => {
    expect(isReferenceCode("GR-7K3M9Q")).toBe(true);
    expect(isReferenceCode("GR-ABCDEF")).toBe(true);
  });
  it("rejects confusable characters I, L, O, 0, 1 and bad shapes", () => {
    for (const bad of ["GR-7K3M9L", "GR-7K3M9I", "GR-7K3M9O", "GR-7K3M90", "GR-7K3M91"]) {
      expect(isReferenceCode(bad)).toBe(false);
    }
    expect(isReferenceCode("GR-7K3M9")).toBe(false);
    expect(isReferenceCode("XX-7K3M9Q")).toBe(false);
    expect(isReferenceCode("gr-7k3m9q")).toBe(false);
  });
  it("referral candidates: new 6-char codes and seeded D-codes pass, junk fails", () => {
    expect(isReferralCodeCandidate("7K3M9Q")).toBe(true);
    expect(isReferralCodeCandidate("D00101")).toBe(true);
    expect(isReferralCodeCandidate("")).toBe(false);
    expect(isReferralCodeCandidate("has space")).toBe(false);
    expect(isReferralCodeCandidate("x".repeat(33))).toBe(false);
  });
});

describe("mapFunnelError", () => {
  it("maps RPC error tokens to Georgian messages", () => {
    expect(mapFunnelError("P0001: duplicate_personal_id")).toBe(
      "ეს პირადი ნომერი უკვე რეგისტრირებულია.",
    );
    expect(mapFunnelError("terms_required")).toBe("საჭიროა წესებზე თანხმობა.");
  });
  it("unknown/empty → generic Georgian error", () => {
    expect(mapFunnelError("something weird")).toBe(GENERIC_FUNNEL_ERROR);
    expect(mapFunnelError(undefined)).toBe(GENERIC_FUNNEL_ERROR);
  });
});

describe("TIERS", () => {
  it("is exactly 5/10/20", () => {
    expect([...TIERS]).toEqual([5, 10, 20]);
  });
});
