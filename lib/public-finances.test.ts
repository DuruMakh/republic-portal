import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FINANCES_HREF, filterFinanceLinks, showPublicFinances } from "./public-finances";

const SWITCH = "SHOW_PUBLIC_FINANCES";
const original = process.env[SWITCH];

beforeEach(() => {
  delete process.env[SWITCH];
});

afterEach(() => {
  if (original === undefined) delete process.env[SWITCH];
  else process.env[SWITCH] = original;
});

describe("showPublicFinances", () => {
  it("is hidden when the switch is not set", () => {
    expect(showPublicFinances()).toBe(false);
  });

  it.each(["1", "TRUE", "True", "yes", "false", ""])(
    "stays hidden for %j — only the word true turns finances on",
    (value) => {
      process.env[SWITCH] = value;
      expect(showPublicFinances()).toBe(false);
    },
  );

  it("is public when the switch is true", () => {
    process.env[SWITCH] = "true";
    expect(showPublicFinances()).toBe(true);
  });

  // `echo true | vercel env add` stores "true\n"; padding must not leave finances hidden after
  // someone believes they switched them back on.
  it.each([" true", "true ", "true\n", "true\r\n"])(
    "is public for %j — whitespace around the word is ignored",
    (value) => {
      process.env[SWITCH] = value;
      expect(showPublicFinances()).toBe(true);
    },
  );
});

describe("filterFinanceLinks", () => {
  const links = [
    { href: "/news", label: "news" },
    { href: FINANCES_HREF, label: "finances" },
    { href: "/support", label: "support" },
  ];

  it("drops the finance link and keeps the rest in order while finances are hidden", () => {
    expect(filterFinanceLinks(links, false).map((link) => link.href)).toEqual([
      "/news",
      "/support",
    ]);
  });

  it("keeps every link, in its original order, when finances are public", () => {
    expect(filterFinanceLinks(links, true)).toEqual(links);
  });

  it("never mutates the list it was given", () => {
    const before = [...links];
    filterFinanceLinks(links, false);
    expect(links).toEqual(before);
  });
});
