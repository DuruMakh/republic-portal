import { describe, expect, it } from "vitest";
import { localePath, stripLocale } from "./routing";

describe("language addresses", () => {
  it("keeps Georgian addresses and adds English exactly once", () => {
    expect(localePath("/", "ka")).toBe("/");
    expect(localePath("/", "en")).toBe("/en");
    expect(localePath("/en/about", "en")).toBe("/en/about");
    expect(localePath("/en/about", "ka")).toBe("/about");
    expect(stripLocale("/enough")).toBe("/enough");
  });
  it("keeps referral parameters and section anchors", () => {
    expect(localePath("/join?ref=ABC#details", "en")).toBe("/en/join?ref=ABC#details");
    expect(localePath("/en/principles#principle-5", "ka")).toBe("/principles#principle-5");
    expect(localePath("/en?ref=ABC#join", "ka")).toBe("/?ref=ABC#join");
    expect(localePath("/?ref=ABC#join", "en")).toBe("/en?ref=ABC#join");
  });
  it("keeps administration, APIs, shared files and external addresses unchanged", () => {
    for (const href of [
      "/admin",
      "/admin/members",
      "/api/dev/otp",
      "/auth/callback",
      "/file.pdf",
      "https://example.com",
      "mailto:a@example.com",
      "#section",
    ]) {
      expect(localePath(href, "en")).toBe(href);
    }
  });
});
