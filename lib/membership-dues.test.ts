import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BILLING_HREF, filterBillingLinks, showMembershipDues } from "./membership-dues";

const SWITCH = "SHOW_MEMBERSHIP_DUES";
const original = process.env[SWITCH];

beforeEach(() => {
  delete process.env[SWITCH];
});

afterEach(() => {
  if (original === undefined) delete process.env[SWITCH];
  else process.env[SWITCH] = original;
});

describe("showMembershipDues", () => {
  it("is hidden when the switch is not set", () => {
    expect(showMembershipDues()).toBe(false);
  });

  it.each(["1", "TRUE", "yes", "false", ""])(
    "stays hidden for %j — only the word true turns dues on",
    (value) => {
      process.env[SWITCH] = value;
      expect(showMembershipDues()).toBe(false);
    },
  );

  it.each(["true", " true", "true\n"])("is on for %j", (value) => {
    process.env[SWITCH] = value;
    expect(showMembershipDues()).toBe(true);
  });
});

describe("filterBillingLinks", () => {
  const links = [
    { href: "/me/profile", label: "a" },
    { href: BILLING_HREF, label: "b" },
  ];

  it("drops the billing link while dues are hidden", () => {
    expect(filterBillingLinks(links, false).map((l) => l.href)).toEqual(["/me/profile"]);
  });

  it("keeps every link while dues are on, without mutating the input", () => {
    const out = filterBillingLinks(links, true);
    expect(out).toEqual(links);
    expect(out).not.toBe(links);
  });
});
