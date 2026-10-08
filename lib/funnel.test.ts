import { describe, expect, it } from "vitest";
import {
  deriveMembershipPhase,
  ERROR_MESSAGES,
  GENERIC_FUNNEL_ERROR,
  isReferenceCode,
  isReferralCodeCandidate,
  mapFunnelError,
  type CabinetStatePresent,
} from "./funnel";

function cab(overrides: Partial<CabinetStatePresent>): CabinetStatePresent {
  return {
    exists: true,
    standing: "registered",
    status: "registered",
    role: "member",
    firstName: "ნინო",
    lastName: "ბერიძე",
    personalIdMasked: "010********",
    hasPersonalId: true,
    referralCode: null,
    referralCount: 0,
    birthDate: null,
    regionId: null,
    cityId: null,
    employment: null,
    tier: null,
    referenceCode: null,
    completed: false,
    delegateStatus: null,
    referral: null,
    pendingDelegate: null,
    chosenDelegate: null,
    membershipExists: false,
    registrationCompletedAt: null,
    createdAt: "2026-07-21T10:00:00Z",
    admin: false,
    ...overrides,
  };
}

describe("deriveMembershipPhase", () => {
  it("fresh registered person → profile phase", () => {
    expect(deriveMembershipPhase(cab({}))).toBe("profile");
  });
  it("partially saved profile still → profile phase (any field missing)", () => {
    expect(deriveMembershipPhase(cab({ birthDate: "1990-05-20", regionId: 3 }))).toBe("profile");
  });
  it("all wizard fields saved → tier phase", () => {
    expect(
      deriveMembershipPhase(
        cab({ birthDate: "1990-05-20", regionId: 3, cityId: 7, employment: "სტუდენტი" }),
      ),
    ).toBe("tier");
  });
  it("completed member → done, regardless of field snapshot", () => {
    expect(deriveMembershipPhase(cab({ standing: "member", completed: true }))).toBe("done");
  });
  it("absent profile (cabinet_state() { exists: false }) never mis-derives 'tier'", () => {
    // The RPC's no-profile branch returns ONLY { exists: false }; every wizard
    // field is undefined at runtime. The old all-fields-required type let this
    // reach the `undefined !== null` checks and return 'tier' for a nonexistent
    // profile (finding V8). It must resolve to the safe 'profile' phase instead.
    expect(deriveMembershipPhase({ exists: false })).toBe("profile");
  });
});

describe("code formats", () => {
  it("accepts valid reference codes", () => {
    expect(isReferenceCode("GR-7K3M9Q")).toBe(true);
    expect(isReferenceCode("GR-ABCDEF")).toBe(true);
    expect(isReferenceCode("GR-APQ694")).toBe(true);
  });
  it("rejects confusable characters I, L, O, 0, 1 and bad shapes", () => {
    for (const bad of ["GR-7K3M9L", "GR-7K3M9I", "GR-7K3M9O", "GR-7K3M90", "GR-7K3M91"]) {
      expect(isReferenceCode(bad)).toBe(false);
    }
    expect(isReferenceCode("GR-7K3M9")).toBe(false);
    expect(isReferenceCode("GR-APQ6944")).toBe(false);
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
  // mapFunnelError matches by substring in insertion order, so a token that is a
  // prefix of a later one (invalid_option / invalid_options, invalid_date /
  // invalid_event_dates) would shadow it. Every token, bare and as the RPC
  // reports it, must reach its own message.
  it.each(Object.keys(ERROR_MESSAGES))("maps %s to its own message", (token) => {
    const message = ERROR_MESSAGES[token];
    expect(mapFunnelError(token)).toBe(message);
    expect(mapFunnelError(`P0001: ${token}`)).toBe(message);
  });
  it("raw 23505 unique-violation text never mislabels as a payment duplicate", () => {
    expect(mapFunnelError('duplicate key value violates unique constraint "one_active"')).toBe(
      GENERIC_FUNNEL_ERROR,
    );
  });
  it("unknown/empty → generic Georgian error", () => {
    expect(mapFunnelError("something weird")).toBe(GENERIC_FUNNEL_ERROR);
    expect(mapFunnelError(undefined)).toBe(GENERIC_FUNNEL_ERROR);
  });
});
