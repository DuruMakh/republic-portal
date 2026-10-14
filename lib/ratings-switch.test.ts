import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RATINGS_HREF, filterRatingLinks, showRatings } from "./ratings-switch";

const SWITCH = "SHOW_RATINGS";
const original = process.env[SWITCH];

beforeEach(() => {
  delete process.env[SWITCH];
});

afterEach(() => {
  if (original === undefined) delete process.env[SWITCH];
  else process.env[SWITCH] = original;
});

describe("showRatings", () => {
  it("is hidden when the switch is not set", () => {
    expect(showRatings()).toBe(false);
  });

  it.each(["1", "TRUE", "yes", "false", ""])(
    "stays hidden for %j — only the word true turns ratings on",
    (value) => {
      process.env[SWITCH] = value;
      expect(showRatings()).toBe(false);
    },
  );

  it.each(["true", " true", "true\n"])("is on for %j", (value) => {
    process.env[SWITCH] = value;
    expect(showRatings()).toBe(true);
  });
});

describe("filterRatingLinks", () => {
  const links = [
    { href: "/", label: "a" },
    { href: RATINGS_HREF, label: "b" },
    { href: "/structure", label: "c" },
  ];

  it("drops the ratings link while ratings are hidden", () => {
    expect(filterRatingLinks(links, false).map((l) => l.href)).toEqual(["/", "/structure"]);
  });

  it("keeps every link while ratings are on, without mutating the input", () => {
    const out = filterRatingLinks(links, true);
    expect(out).toEqual(links);
    expect(out).not.toBe(links);
  });
});
