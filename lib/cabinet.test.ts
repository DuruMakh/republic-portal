import { describe, expect, it } from "vitest";
import {
  buildReferralUrl,
  cabinetNavItems,
  deriveDestination,
  EMPLOYMENT_OTHER,
  employmentToForm,
  formatAmountGel,
  formatDateKa,
  formatPhoneKa,
  formToEmployment,
  initialsKa,
  memberSinceKa,
  paymentMethodLabel,
  TEAM_STATUS_LABELS,
} from "./cabinet";
import type { FunnelState } from "./funnel";

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
    status: "draft",
    registrationCompletedAt: null,
    createdAt: "2026-07-01T00:00:00Z",
    delegateStatus: null,
    referral: null,
    chosenDelegate: null,
    membershipExists: false,
    admin: false,
    ...overrides,
  };
}

describe("deriveDestination (spec §3.2)", () => {
  it("no session state or no profile → /join", () => {
    expect(deriveDestination(null)).toBe("/join");
    expect(deriveDestination(state({ exists: false }))).toBe("/join");
  });
  it("unfinished registration → the derived funnel step", () => {
    expect(deriveDestination(state({}))).toBe("/join/step-2");
    expect(deriveDestination(state({ personalIdSet: true }))).toBe("/join/step-3");
  });
  it("completed member → /me/profile", () => {
    expect(
      deriveDestination(
        state({
          personalIdSet: true,
          completed: true,
          status: "profile_completed",
          registrationCompletedAt: "2026-07-15T10:00:00Z",
        }),
      ),
    ).toBe("/me/profile");
  });
  it("delegate (any verification status) → /delegate", () => {
    for (const delegateStatus of ["pending", "approved", "rejected"] as const) {
      expect(
        deriveDestination(
          state({ role: "delegate", personalIdSet: true, completed: true, delegateStatus }),
        ),
      ).toBe("/delegate");
    }
  });
  it("legacy active_member (no registration_completed_at) counts as completed", () => {
    expect(
      deriveDestination(state({ personalIdSet: true, completed: true, status: "active_member" })),
    ).toBe("/me/profile");
  });
});

describe("cabinetNavItems (spec §3.1)", () => {
  it("member: profile / my delegate / billing", () => {
    expect(cabinetNavItems("member")).toEqual([
      { href: "/me/profile", label: "პროფილი" },
      { href: "/me/delegate", label: "ჩემი დელეგატი" },
      { href: "/me/billing", label: "გადახდები" },
    ]);
  });
  it("delegate: profile / billing / panel — no „ჩემი დელეგატი“", () => {
    expect(cabinetNavItems("delegate")).toEqual([
      { href: "/me/profile", label: "პროფილი" },
      { href: "/me/billing", label: "გადახდები" },
      { href: "/delegate", label: "დელეგატის პანელი" },
    ]);
  });
  it("admins get the ადმინისტრირება tab appended (spec §3.1)", () => {
    expect(cabinetNavItems("member", true).at(-1)).toEqual({
      href: "/admin",
      label: "ადმინისტრირება",
    });
    expect(cabinetNavItems("delegate", true).at(-1)).toEqual({
      href: "/admin",
      label: "ადმინისტრირება",
    });
    expect(cabinetNavItems("member", false).some((i) => i.href === "/admin")).toBe(false);
    expect(cabinetNavItems("member")).toEqual(cabinetNavItems("member", false));
  });
});

describe("employment mapping (spec §3.3)", () => {
  it("preset value round-trips", () => {
    expect(employmentToForm("სტუდენტი")).toEqual({ choice: "სტუდენტი", custom: "" });
    expect(formToEmployment({ choice: "სტუდენტი", custom: "" })).toBe("სტუდენტი");
  });
  it("non-preset value renders as „სხვა“ with the text filled", () => {
    expect(employmentToForm("მეწარმე")).toEqual({ choice: EMPLOYMENT_OTHER, custom: "მეწარმე" });
    expect(formToEmployment({ choice: EMPLOYMENT_OTHER, custom: "  მეწარმე " })).toBe("მეწარმე");
  });
  it("null (legacy) → empty „სხვა“", () => {
    expect(employmentToForm(null)).toEqual({ choice: EMPLOYMENT_OTHER, custom: "" });
  });
});

describe("memberSinceKa", () => {
  it("formats year + -დან month in Tbilisi time (syncope forms correct)", () => {
    expect(memberSinceKa("2026-02-10T08:30:00Z")).toBe("2026 წლის თებერვლიდან");
    expect(memberSinceKa("2026-01-01T00:00:00Z")).toBe("2026 წლის იანვრიდან");
    // Georgia is UTC+4: 21:30Z on 31 July is 01:30 on 1 August locally → აგვისტო
    expect(memberSinceKa("2026-07-31T21:30:00Z")).toBe("2026 წლის აგვისტოდან");
    expect(memberSinceKa("2026-09-15T12:00:00Z")).toBe("2026 წლის სექტემბრიდან");
  });
  it("null / invalid → null", () => {
    expect(memberSinceKa(null)).toBeNull();
    expect(memberSinceKa("garbage")).toBeNull();
  });
});

describe("formatPhoneKa", () => {
  it("formats E.164 with and without + (auth stores it without)", () => {
    expect(formatPhoneKa("+995599123456")).toBe("+995 599 12 34 56");
    expect(formatPhoneKa("995599123456")).toBe("+995 599 12 34 56");
  });
  it("unknown shapes pass through; empty → —", () => {
    expect(formatPhoneKa("12345")).toBe("12345");
    expect(formatPhoneKa(null)).toBe("—");
    expect(formatPhoneKa(undefined)).toBe("—");
  });
});

describe("formatDateKa / initialsKa / labels", () => {
  it("dd.mm.yyyy in Tbilisi time, deterministic (no ICU)", () => {
    expect(formatDateKa("2026-07-15")).toBe("15.07.2026"); // date-only stays put
    expect(formatDateKa("2026-07-15T10:00:00Z")).toBe("15.07.2026");
    // UTC+4: 22:10Z on the 15th is 02:10 on the 16th locally
    expect(formatDateKa("2026-07-15T22:10:00Z")).toBe("16.07.2026");
    expect(formatDateKa("garbage")).toBe("garbage");
  });
  it("initials from Georgian names", () => {
    expect(initialsKa("ნინო", "ბერიძე")).toBe("ნბ");
  });
  it("team status labels (spec §3.7)", () => {
    expect(TEAM_STATUS_LABELS.profile_completed).toBe("რეგისტრირებული");
    expect(TEAM_STATUS_LABELS.active_member).toBe("აქტიური");
  });
  it("payment method label", () => {
    expect(paymentMethodLabel("manual")).toBe("გადარიცხვა");
    expect(paymentMethodLabel("future_gateway")).toBe("future_gateway");
  });
});

describe("formatAmountGel", () => {
  it("renders numeric(10,2) amounts with a fixed two decimals", () => {
    expect(formatAmountGel(50.5)).toBe("50.50"); // trailing zero preserved
    expect(formatAmountGel(50)).toBe("50.00");
    expect(formatAmountGel(1234.5)).toBe("1234.50");
  });
});

describe("buildReferralUrl", () => {
  it("joins origin + /join?ref=, stripping trailing slashes and encoding the code", () => {
    expect(buildReferralUrl("https://republic-portal.vercel.app", "D00101")).toBe(
      "https://republic-portal.vercel.app/join?ref=D00101",
    );
    expect(buildReferralUrl("http://localhost:3000/", "AB2C3D")).toBe(
      "http://localhost:3000/join?ref=AB2C3D",
    );
  });
});
