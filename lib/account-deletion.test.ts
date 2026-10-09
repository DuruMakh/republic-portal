import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETION_CONFIRM_WORD,
  adminDeleteMemberSchema,
  delegatePhotoPath,
  deleteAccountSchema,
} from "./account-deletion";
import { mapFunnelError } from "./funnel";

describe("deleteAccountSchema", () => {
  it("accepts the word with surrounding spaces and nothing else", () => {
    expect(
      deleteAccountSchema.safeParse({ confirm: ` ${ACCOUNT_DELETION_CONFIRM_WORD} ` }).success,
    ).toBe(true);
    expect(deleteAccountSchema.safeParse({ confirm: "delete" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({}).success).toBe(false);
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
