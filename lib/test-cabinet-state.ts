import type { CabinetStatePresent } from "@/lib/funnel";

/** A complete cabinet_state() row for page tests; override only what a test cares about. */
export function cabinetStateFixture(
  overrides: Partial<CabinetStatePresent> = {},
): CabinetStatePresent {
  return {
    exists: true,
    standing: "member",
    status: "profile_completed",
    role: "member",
    firstName: "ნინო",
    lastName: "ბერიძე",
    personalIdMasked: "010********",
    hasPersonalId: true,
    referralCode: null,
    referralCount: 0,
    birthDate: null,
    regionId: 1,
    cityId: null,
    employment: null,
    tier: 10,
    referenceCode: "GR-APQ694",
    completed: true,
    delegateStatus: null,
    referral: null,
    pendingDelegate: null,
    chosenDelegate: null,
    membershipExists: true,
    registrationCompletedAt: "2026-10-01T10:00:00Z",
    createdAt: "2026-09-30T10:00:00Z",
    admin: false,
    ...overrides,
  };
}
