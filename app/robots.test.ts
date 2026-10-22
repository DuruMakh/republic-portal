import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ production: true }));
vi.mock("@/lib/env", () => ({ isProductionEnv: () => env.production }));
vi.mock("@/lib/site", () => ({ siteUrl: () => "https://example.test" }));

import robots from "./robots";

afterEach(() => {
  env.production = true;
});

type Rule = {
  userAgent?: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
};

function rulesOf(): Rule {
  const { rules } = robots();
  if (Array.isArray(rules)) throw new Error("expected one rule group");
  return rules;
}

/** How crawlers read a Disallow line: a prefix, or an exact address when it ends in `$`. */
function blocks(rule: string, path: string): boolean {
  return rule.endsWith("$") ? path === rule.slice(0, -1) : path.startsWith(rule);
}

function blocked(path: string): boolean {
  const disallow = rulesOf().disallow ?? [];
  return (Array.isArray(disallow) ? disallow : [disallow]).some((rule) => blocks(rule, path));
}

describe("robots.txt in production", () => {
  it("allows the site, keeps the private areas out and points at the sitemap", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/me$", "/me/", "/delegate$", "/delegate/", "/api/", "/auth/"],
      },
      sitemap: "https://example.test/sitemap.xml",
    });
  });

  it.each(["/", "/news/x", "/join", "/login", "/delegates/levan-nishnianidze", "/members"])(
    "leaves the public address %s crawlable",
    (path) => {
      expect(blocked(path)).toBe(false);
    },
  );

  it.each(["/delegate", "/delegate/team", "/me", "/me/profile", "/admin/members", "/api/x"])(
    "keeps the private address %s out",
    (path) => {
      expect(blocked(path)).toBe(true);
    },
  );
});

describe("robots.txt outside production", () => {
  it("keeps every address out and names no sitemap", () => {
    env.production = false;
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});
