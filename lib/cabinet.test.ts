import { describe, expect, it } from "vitest";
import {
  buildReferralUrl,
  cabinetNavItems,
  cabinetRole,
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
  paymentStatusKa,
  TEAM_STATUS_LABELS,
} from "./cabinet";
import type { CabinetStatePresent } from "./funnel";

function cab(overrides: Partial<CabinetStatePresent>): CabinetStatePresent {
  return {
    exists: true,
    standing: "registered",
    status: "registered",
    role: "member",
    firstName: "ნინო",
    lastName: "ბერიძე",
    personalIdMasked: "010********",
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

describe("deriveDestination", () => {
  it("no profile → /join", () => {
    expect(deriveDestination(null)).toBe("/join");
    // the absent variant is exactly the RPC's no-profile payload — nothing else
    expect(deriveDestination({ exists: false })).toBe("/join");
  });
  it("registered → /me overview", () => {
    expect(deriveDestination(cab({}))).toBe("/me");
  });
  it("member → /me/profile", () => {
    expect(deriveDestination(cab({ standing: "member", completed: true }))).toBe("/me/profile");
  });
  it("delegates row (any status) → /delegate", () => {
    expect(
      deriveDestination(
        cab({ standing: "member", completed: true, role: "delegate", delegateStatus: "pending" }),
      ),
    ).toBe("/delegate");
  });
});

describe("cabinetRole + nav", () => {
  it("maps standing/role to the nav variant", () => {
    expect(cabinetRole(cab({}))).toBe("registered");
    expect(cabinetRole(cab({ standing: "member", completed: true }))).toBe("member");
    expect(cabinetRole(cab({ standing: "member", completed: true, role: "delegate" }))).toBe(
      "delegate",
    );
  });
  it("registered nav: overview, events, news, profile — nothing member-only", () => {
    const hrefs = cabinetNavItems("registered").map((i) => i.href);
    expect(hrefs).toEqual(["/me", "/me/events", "/me/news", "/me/profile"]);
  });
  it("member/delegate/registered navs + admin tab appends", () => {
    expect(cabinetNavItems("member").map((i) => i.href)).toEqual([
      "/me/profile",
      "/me/delegate",
      "/me/billing",
      "/me/news",
      "/me/events",
      "/me/polls",
    ]);
    expect(cabinetNavItems("delegate").map((i) => i.href)).toEqual([
      "/me/profile",
      "/me/billing",
      "/me/news",
      "/me/events",
      "/me/polls",
      "/delegate",
    ]);
    expect(cabinetNavItems("registered", true).at(-1)?.href).toBe("/admin");
  });
});

it("team vocabulary: profile_completed is now „წევრი“", () => {
  expect(TEAM_STATUS_LABELS.profile_completed).toBe("წევრი");
  expect(TEAM_STATUS_LABELS.active_member).toBe("აქტიური");
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

describe("paymentStatusKa (Phase 4 §8 — honest voids)", () => {
  it("live rows are დადასტურებული, voided rows are გაუქმებული", () => {
    expect(paymentStatusKa(null)).toEqual({ label: "დადასტურებული", pillStatus: "active_member" });
    expect(paymentStatusKa("2026-07-17T10:00:00Z")).toEqual({
      label: "გაუქმებული",
      pillStatus: "rejected",
    });
  });
});
