// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateSession = vi.fn(
  async (_request: NextRequest, response = NextResponse.next()) => response,
);
vi.mock("@/lib/supabase/middleware", () => ({ updateSession }));

const { proxy } = await import("./proxy");

const SWITCHES = ["SHOW_PUBLIC_FINANCES", "SHOW_EVENTS", "SHOW_RATINGS"] as const;
const original = Object.fromEntries(SWITCHES.map((name) => [name, process.env[name]]));

beforeEach(() => {
  for (const name of SWITCHES) delete process.env[name];
  updateSession.mockClear();
});

afterEach(() => {
  for (const name of SWITCHES) {
    const value = original[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const call = (path: string) => proxy(new NextRequest(`http://localhost:3000${path}`));

describe("proxy", () => {
  it("ignores a forged locale header and keeps an English browser on Georgian URLs", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/about", {
        headers: { "x-portal-locale": "en", "accept-language": "en" },
      }),
    );
    expect(response.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/ka/about");
    expect(response.headers.get("x-middleware-request-x-portal-locale")).toBe("ka");
  });
  it("keeps administration Georgian and preserves its query", async () => {
    const response = await call("/en/admin/members?q=test");
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/members?q=test");
  });
  it.each(["/en/transparency", "/en/events/any-event-slug", "/en/leaderboard"])(
    "keeps hidden English page %s inaccessible",
    async (path) => {
      const response = await call(path);
      expect(response.status).toBe(404);
      expect(response.headers.get("x-middleware-rewrite")).toBe(
        "http://localhost:3000/en/missing-page",
      );
      expect(updateSession).not.toHaveBeenCalled();
    },
  );
  it.each(["/transparency", "/events", "/events/any-event-slug", "/leaderboard"])(
    "answers hidden %s with the site-wide not-found page, before any page cache",
    async (path) => {
      const response = await call(path);
      expect(response.headers.get("x-middleware-rewrite")).toBe(
        "http://localhost:3000/ka/missing-page",
      );
      // said outright: on Vercel a bare rewrite to /_not-found answers 200 (probe, ADR-040)
      expect(response.status).toBe(404);
      expect(updateSession).not.toHaveBeenCalled();
    },
  );

  it("passes a page through once its switch is on", async () => {
    process.env.SHOW_PUBLIC_FINANCES = "true";
    process.env.SHOW_EVENTS = "true";
    process.env.SHOW_RATINGS = "true";
    for (const path of ["/transparency", "/events", "/leaderboard"]) {
      const response = await call(path);
      expect(response.headers.get("x-middleware-rewrite")).toBe(`http://localhost:3000/ka${path}`);
    }
    expect(updateSession).toHaveBeenCalledTimes(3);
  });

  it("refreshes the session on ordinary pages", async () => {
    const response = await call("/news");
    expect(response.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/ka/news");
    expect(updateSession).toHaveBeenCalledTimes(1);
  });
});
