import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BOARD_MEMBERS, boardMemberSchema } from "./board-members";

// Latin placeholders only: real members' Georgian names arrive later via owner-approved edits.
const valid = {
  name: "Test Member",
  photo: "/board/test-member.jpg",
  bio: "Short bio.",
  socials: [
    { network: "facebook", url: "https://www.facebook.com/test.member" },
    { network: "tiktok", url: "https://www.tiktok.com/@testmember" },
    { network: "linkedin", url: "https://www.linkedin.com/in/test-member" },
  ],
};

describe("boardMemberSchema", () => {
  it("accepts a complete member, and one with no social links", () => {
    expect(boardMemberSchema.safeParse(valid).success).toBe(true);
    expect(boardMemberSchema.safeParse({ ...valid, socials: [] }).success).toBe(true);
  });

  it("rejects contact fields the owner ruled out (email, phone)", () => {
    expect(boardMemberSchema.safeParse({ ...valid, email: "a@b.ge" }).success).toBe(false);
    expect(boardMemberSchema.safeParse({ ...valid, phone: "+995555000000" }).success).toBe(false);
  });

  it("rejects networks outside facebook, tiktok, linkedin", () => {
    const socials = [{ network: "instagram", url: "https://www.instagram.com/x" }];
    expect(boardMemberSchema.safeParse({ ...valid, socials }).success).toBe(false);
  });

  it("rejects a link that is not https on that network's own host", () => {
    for (const url of [
      "http://www.facebook.com/x",
      "https://evil.example/facebook.com",
      "https://facebook.com.evil.example/x",
      "mailto:a@b.ge",
      "https://user:pass@www.facebook.com/x",
    ]) {
      const socials = [{ network: "facebook", url }];
      expect(boardMemberSchema.safeParse({ ...valid, socials }).success, url).toBe(false);
    }
  });

  it("rejects the same network twice for one person", () => {
    const socials = [valid.socials[0], valid.socials[0]];
    expect(boardMemberSchema.safeParse({ ...valid, socials }).success).toBe(false);
  });

  it("rejects photos outside /board/ and bios that are empty or over 300 characters", () => {
    expect(boardMemberSchema.safeParse({ ...valid, photo: "https://x.ge/a.jpg" }).success).toBe(
      false,
    );
    expect(boardMemberSchema.safeParse({ ...valid, photo: "/board/../secret.jpg" }).success).toBe(
      false,
    );
    expect(boardMemberSchema.safeParse({ ...valid, bio: " " }).success).toBe(false);
    expect(boardMemberSchema.safeParse({ ...valid, bio: "a".repeat(301) }).success).toBe(false);
  });
});

describe("BOARD_MEMBERS", () => {
  it("every entry passes the schema and its photo file exists in public/", () => {
    for (const member of BOARD_MEMBERS) {
      expect(boardMemberSchema.safeParse(member).success, member.name).toBe(true);
      expect(existsSync(path.join(process.cwd(), "public", member.photo)), member.photo).toBe(true);
    }
  });
});
