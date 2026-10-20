import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { languageAlternates } from "./metadata";

beforeEach(() => {
  vi.stubEnv("SHOW_ENGLISH", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("languageAlternates", () => {
  it("names only the Georgian address while English is hidden", () => {
    expect(languageAlternates("/about", "ka")).toEqual({ alternates: { canonical: "/about" } });
  });

  it("pairs the Georgian and English addresses once English is on", () => {
    vi.stubEnv("SHOW_ENGLISH", "true");
    expect(languageAlternates("/about", "en")).toEqual({
      alternates: {
        canonical: "/en/about",
        languages: { ka: "/about", en: "/en/about", "x-default": "/about" },
      },
    });
  });
});
