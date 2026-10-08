// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateSession = vi.fn(async () => NextResponse.next());
vi.mock("@/lib/supabase/middleware", () => ({ updateSession }));

const { proxy } = await import("./proxy");

const SWITCHES = ["SHOW_PUBLIC_FINANCES", "SHOW_EVENTS"] as const;
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
  it.each(["/transparency", "/events", "/events/any-event-slug"])(
    "answers hidden %s with the site-wide not-found page, before any page cache",
    async (path) => {
      const response = await call(path);
      expect(response.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/_not-found");
      // said outright: on Vercel a bare rewrite to /_not-found answers 200 (probe, ADR-040)
      expect(response.status).toBe(404);
      expect(updateSession).not.toHaveBeenCalled();
    },
  );

  it("passes a page through once its switch is on", async () => {
    process.env.SHOW_PUBLIC_FINANCES = "true";
    process.env.SHOW_EVENTS = "true";
    for (const path of ["/transparency", "/events"]) {
      const response = await call(path);
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    }
    expect(updateSession).toHaveBeenCalledTimes(2);
  });

  it("refreshes the session on ordinary pages", async () => {
    const response = await call("/news");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(updateSession).toHaveBeenCalledTimes(1);
  });
});
