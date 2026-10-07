import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CabinetStatePresent } from "@/lib/funnel";

const redirectMock = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`);
});
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirectMock(path) }));

const getCabinetStateMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ getCabinetState: () => getCabinetStateMock() }));

import MembershipDonePage from "./page";

function completed(overrides: Partial<CabinetStatePresent> = {}): CabinetStatePresent {
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
    birthDate: "1990-05-20",
    regionId: 1,
    cityId: 5,
    employment: "სტუდენტი",
    tier: 10,
    referenceCode: "GR-APQ694",
    completed: true,
    delegateStatus: null,
    referral: null,
    pendingDelegate: null,
    chosenDelegate: null,
    membershipExists: true,
    registrationCompletedAt: "2026-10-07T10:00:00Z",
    createdAt: "2026-07-21T10:00:00Z",
    admin: false,
    ...overrides,
  };
}

beforeEach(() => {
  redirectMock.mockClear();
  getCabinetStateMock.mockReset();
});

describe("membership done page (ADR-036)", () => {
  it("tells a fresh applicant the board will review the application, with no transfer instructions", async () => {
    getCabinetStateMock.mockResolvedValue(completed());
    render(await MembershipDonePage());
    expect(screen.getByRole("heading", { name: "განაცხადი გაგზავნილია ✓" })).toBeInTheDocument();
    expect(screen.getByText("განხილვის პროცესში")).toBeInTheDocument();
    expect(screen.getByText("შენს განაცხადს განიხილავს ბორდი.")).toBeInTheDocument();
    expect(screen.queryByTestId("reference-code")).toBeNull();
    expect(screen.queryByText("GR-APQ694")).toBeNull();
  });

  it("does not tell an already-active member their application is under review", async () => {
    getCabinetStateMock.mockResolvedValue(completed({ status: "active_member" }));
    render(await MembershipDonePage());
    expect(screen.queryByText("განხილვის პროცესში")).toBeNull();
    expect(screen.queryByText("შენს განაცხადს განიხილავს ბორდი.")).toBeNull();
    expect(screen.queryByRole("heading", { name: "განაცხადი გაგზავნილია ✓" })).toBeNull();
    expect(screen.getByText("აქტიური წევრი")).toBeInTheDocument();
  });
});
