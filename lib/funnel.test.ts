import { describe, expect, it } from "vitest";
import {
  deriveMembershipPhase,
  GENERIC_FUNNEL_ERROR,
  isReferenceCode,
  isReferralCodeCandidate,
  mapFunnelError,
  TIERS,
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

describe("isReferenceCode — derived from FUNNEL_CODE_ALPHABET (Phase 3 hygiene)", () => {
  it("accepts exactly the Phase 2 fixtures", () => {
    expect(isReferenceCode("GR-APQ694")).toBe(true);
    expect(isReferenceCode("GR-7K3M9Q")).toBe(true);
  });
  it("rejects excluded characters I/L/O/0/1, lowercase, wrong length", () => {
    for (const bad of ["GR-AAAAI2", "GR-AAAAL2", "GR-AAAAO2", "GR-AAAA02", "GR-AAAA12"]) {
      expect(isReferenceCode(bad)).toBe(false);
    }
    expect(isReferenceCode("gr-apq694")).toBe(false);
    expect(isReferenceCode("GR-APQ69")).toBe(false);
    expect(isReferenceCode("GR-APQ6944")).toBe(false);
  });
});

describe("mapFunnelError — Phase 3 tokens", () => {
  it("maps the cabinet RPC tokens to Georgian", () => {
    expect(mapFunnelError("not_completed")).toBe("ჯერ დაასრულე რეგისტრაცია.");
    expect(mapFunnelError("P0001: not_a_member")).toBe("ეს მოქმედება მხოლოდ წევრებისთვისაა.");
    expect(mapFunnelError("not_a_delegate")).toBe("დელეგატის პანელი მხოლოდ დელეგატებისთვისაა.");
  });
  it("maps the Phase 4 admin tokens (spec §5)", () => {
    expect(mapFunnelError("P0001: missing_role")).toBe(
      "ამ მოქმედებისთვის საკმარისი უფლება არ გაქვს.",
    );
    expect(mapFunnelError("duplicate_reference")).toBe(
      "ამ საბანკო რეფერენსით გადახდა უკვე აღრიცხულია.",
    );
    expect(mapFunnelError("last_super_admin")).toBe("ბოლო super_admin-ის მოხსნა შეუძლებელია.");
    expect(mapFunnelError("already_voided")).toBe("ეს გადახდა უკვე გაუქმებულია.");
    expect(mapFunnelError("invalid_target")).toBe("ჩანაწერი ვერ მოიძებნა — განაახლე გვერდი.");
    expect(mapFunnelError("unknown_code")).toBe("უცნობი კოდი");
    expect(mapFunnelError("duplicate")).toBe("დუბლიკატი — იდენტური გადახდა უკვე აღრიცხულია.");
    expect(mapFunnelError("P0001: duplicate")).toBe(
      "დუბლიკატი — იდენტური გადახდა უკვე აღრიცხულია.",
    );
  });
  it("raw 23505 unique-violation text never mislabels as a payment duplicate", () => {
    expect(mapFunnelError('duplicate key value violates unique constraint "one_active"')).toBe(
      GENERIC_FUNNEL_ERROR,
    );
  });
});

describe("Phase 5 error tokens", () => {
  it("maps every community token to Georgian", () => {
    expect(mapFunnelError("already_voted")).toBe("ხმა უკვე მიცემულია.");
    expect(mapFunnelError("P0001: poll_closed")).toBe("გამოკითხვა დახურულია.");
    expect(mapFunnelError("rsvp_closed")).toBe("რეგისტრაცია ამ ღონისძიებაზე დახურულია.");
    expect(mapFunnelError("invalid_option")).toBe("აირჩიე პასუხი სიიდან.");
    expect(mapFunnelError("invalid_options")).toBe(
      "პასუხის ვარიანტები არასწორია (2–10, უნიკალური).",
    );
    expect(mapFunnelError("invalid_status")).toBe(
      "მოქმედება ამ მდგომარეობაში შეუძლებელია — განაახლე გვერდი.",
    );
    expect(mapFunnelError("invalid_title")).toBe("სათაური არასწორია (1–160 სიმბოლო).");
    expect(mapFunnelError("invalid_body")).toBe("ტექსტი ცარიელია ან ძალიან გრძელია.");
    expect(mapFunnelError("invalid_location")).toBe("ადგილმდებარეობა არასწორია (1–200 სიმბოლო).");
    expect(mapFunnelError("invalid_event_dates")).toBe("თარიღები არასწორია.");
    expect(mapFunnelError("invalid_question")).toBe("კითხვა არასწორია (1–300 სიმბოლო).");
    expect(mapFunnelError("invalid_image")).toBe("სურათის შენახვა ვერ მოხერხდა.");
  });
});

describe("mapFunnelError — Phase 6 R2 tokens", () => {
  it("maps the new R2 tokens to non-generic Georgian messages", () => {
    expect(mapFunnelError("delegacy_exists")).not.toBe(GENERIC_FUNNEL_ERROR);
    expect(mapFunnelError("invalid_visibility")).not.toBe(GENERIC_FUNNEL_ERROR);
  });
});
