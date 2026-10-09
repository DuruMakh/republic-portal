import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETION_CONFIRM_WORD,
  adminDeleteMemberSchema,
  delegatePhotoPath,
  deleteAccountSchema,
  normalizeName,
} from "./account-deletion";
import {
  ACCOUNT_DELETE_CONFIRM_LABEL,
  ACCOUNT_DELETE_CONFIRM_MISMATCH,
  ACCOUNT_DELETE_LEDE,
  ADMIN_DELETE_NAME_MISMATCH,
  ADMIN_DELETE_REASON_HINT,
  ADMIN_DELETE_REASON_LENGTH,
} from "./account-deletion-copy";
import { ERROR_MESSAGES, GENERIC_FUNNEL_ERROR, mapFunnelError } from "./funnel";

describe("deleteAccountSchema", () => {
  it("accepts the word with surrounding spaces and nothing else", () => {
    expect(
      deleteAccountSchema.safeParse({ confirm: ` ${ACCOUNT_DELETION_CONFIRM_WORD} ` }).success,
    ).toBe(true);
    expect(deleteAccountSchema.safeParse({ confirm: "delete" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({}).success).toBe(false);
  });

  it("answers a wrong word with exactly the mismatch message", () => {
    const result = deleteAccountSchema.safeParse({ confirm: "delete" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toBe(ACCOUNT_DELETE_CONFIRM_MISMATCH);
  });
});

describe("the confirmation word in the copy", () => {
  // The word the person must type is spelled out in three places that cannot import each
  // other's text; if the word ever changes, all three have to change with it.
  it.each([
    ["the label", ACCOUNT_DELETE_CONFIRM_LABEL],
    ["the mismatch message", ACCOUNT_DELETE_CONFIRM_MISMATCH],
    ["the invalid_confirmation error", ERROR_MESSAGES["invalid_confirmation"] ?? ""],
  ])("names the word in %s", (_where, text) => {
    expect(text).toContain(ACCOUNT_DELETION_CONFIRM_WORD);
  });

  it("tells the person that a running poll loses their vote, in the lede", () => {
    expect(ACCOUNT_DELETE_LEDE).toContain("მიმდინარე გამოკითხვებში");
  });
});

describe("adminDeleteMemberSchema", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  it("needs a uuid, a 5-300 character reason and the typed name", () => {
    expect(
      adminDeleteMemberSchema.safeParse({ userId, reason: "წევრის თხოვნა", typedName: "ა ბ" })
        .success,
    ).toBe(true);
    expect(
      adminDeleteMemberSchema.safeParse({ userId, reason: "ok", typedName: "ა ბ" }).success,
    ).toBe(false);
    expect(
      adminDeleteMemberSchema.safeParse({ userId: "x", reason: "წევრის თხოვნა", typedName: "ა ბ" })
        .success,
    ).toBe(false);
  });

  it("speaks Georgian: a too-short or too-long reason, an empty name, a bad id", () => {
    const base = { userId, reason: "წევრის თხოვნა", typedName: "ა ბ" };
    const firstMessage = (input: Record<string, string>) => {
      const result = adminDeleteMemberSchema.safeParse(input);
      return result.success ? null : (result.error.issues[0]?.message ?? null);
    };
    expect(firstMessage({ ...base, reason: "ok" })).toBe(ADMIN_DELETE_REASON_LENGTH);
    expect(firstMessage({ ...base, reason: "ა".repeat(301) })).toBe(ADMIN_DELETE_REASON_LENGTH);
    expect(firstMessage({ ...base, typedName: "   " })).toBe(ADMIN_DELETE_NAME_MISMATCH);
    expect(firstMessage({ ...base, userId: "x" })).toBe(GENERIC_FUNNEL_ERROR);
  });

  it("answers a typed name over 130 characters in Georgian, not with zod's English", () => {
    const result = adminDeleteMemberSchema.safeParse({
      userId,
      reason: "x".repeat(10),
      typedName: "x".repeat(131),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(ADMIN_DELETE_NAME_MISMATCH);
    }
    expect(
      adminDeleteMemberSchema.safeParse({
        userId,
        reason: "x".repeat(10),
        typedName: "x".repeat(130),
      }).success,
    ).toBe(true);
  });

  it("warns the admin to keep the member's name out of the reason, because it stays in the audit log", () => {
    expect(ADMIN_DELETE_REASON_HINT).toContain("აუდიტის ჟურნალში");
  });
});

describe("normalizeName", () => {
  const NBSP = String.fromCharCode(0xa0);

  it("trims the ends and collapses every run of whitespace to one space", () => {
    expect(normalizeName("  Nino   Beridze ")).toBe("Nino Beridze");
    expect(normalizeName("Nino\t\nBeridze")).toBe("Nino Beridze");
  });

  it("treats a non-breaking space as an ordinary one", () => {
    expect(normalizeName(`Nino${NBSP}Beridze${NBSP}`)).toBe("Nino Beridze");
    expect(normalizeName(`${NBSP}Nino ${NBSP} Beridze`)).toBe("Nino Beridze");
  });

  it("composes decomposed characters, so the same letters compare equal", () => {
    const decomposed = `Jose${String.fromCharCode(0x301)} Garcia`;
    const composed = `Jos${String.fromCharCode(0xe9)} Garcia`;
    expect(decomposed).not.toBe(composed);
    expect(normalizeName(decomposed)).toBe(normalizeName(composed));
  });

  it("leaves a name that is already clean alone, and keeps case significant", () => {
    expect(normalizeName("Nino Beridze")).toBe("Nino Beridze");
    expect(normalizeName("nino beridze")).not.toBe(normalizeName("Nino Beridze"));
  });

  it("turns whitespace-only input into the empty string", () => {
    expect(normalizeName(`  ${NBSP} `)).toBe("");
  });
});

describe("delegatePhotoPath", () => {
  it("returns the object path inside the delegate-photos bucket, else null", () => {
    expect(
      delegatePhotoPath("https://x.supabase.co/storage/v1/object/public/delegate-photos/abc-1.jpg"),
    ).toBe("abc-1.jpg");
    expect(delegatePhotoPath("https://elsewhere.example/a.jpg")).toBeNull();
    expect(delegatePhotoPath(null)).toBeNull();
  });
});

describe("error messages", () => {
  it.each([
    "staff_account",
    "staff_history",
    "invalid_confirmation",
    "invalid_reason",
    "cannot_delete_self",
  ])("maps %s to its own Georgian message", (token) => {
    expect(mapFunnelError(token)).not.toBe(mapFunnelError("something_unknown"));
  });
});
