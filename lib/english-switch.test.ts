import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { showEnglish } from "./english-switch";

const SWITCH = "SHOW_ENGLISH";
const original = process.env[SWITCH];

beforeEach(() => {
  delete process.env[SWITCH];
});

afterEach(() => {
  if (original === undefined) delete process.env[SWITCH];
  else process.env[SWITCH] = original;
});

describe("showEnglish", () => {
  it("is hidden when the switch is not set", () => {
    expect(showEnglish()).toBe(false);
  });

  it.each(["1", "TRUE", "yes", "false", ""])(
    "stays hidden for %j — only the word true turns English on",
    (value) => {
      process.env[SWITCH] = value;
      expect(showEnglish()).toBe(false);
    },
  );

  it.each(["true", " true", "true\n"])("is on for %j", (value) => {
    process.env[SWITCH] = value;
    expect(showEnglish()).toBe(true);
  });
});
