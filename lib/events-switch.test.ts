import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { filterEventLinks, showEvents } from "./events-switch";

const SWITCH = "SHOW_EVENTS";
const original = process.env[SWITCH];

beforeEach(() => {
  delete process.env[SWITCH];
});

afterEach(() => {
  if (original === undefined) delete process.env[SWITCH];
  else process.env[SWITCH] = original;
});

describe("showEvents", () => {
  it("is hidden when the switch is not set", () => {
    expect(showEvents()).toBe(false);
  });

  it.each(["1", "TRUE", "yes", "false", ""])(
    "stays hidden for %j — only the word true turns events on",
    (value) => {
      process.env[SWITCH] = value;
      expect(showEvents()).toBe(false);
    },
  );

  it.each(["true", " true", "true\n"])("is on for %j", (value) => {
    process.env[SWITCH] = value;
    expect(showEvents()).toBe(true);
  });
});

describe("filterEventLinks", () => {
  const links = [
    { href: "/", label: "a" },
    { href: "/events", label: "b" },
    { href: "/me/events", label: "c" },
    { href: "/admin/content/events", label: "d" },
    { href: "/me/news", label: "e" },
  ];

  it("drops the public, cabinet and admin events links while events are hidden", () => {
    expect(filterEventLinks(links, false).map((l) => l.href)).toEqual(["/", "/me/news"]);
  });

  it("keeps every link while events are on, without mutating the input", () => {
    const out = filterEventLinks(links, true);
    expect(out).toEqual(links);
    expect(out).not.toBe(links);
  });
});
