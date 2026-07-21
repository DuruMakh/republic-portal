import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { createAdminClient } from "@/lib/supabase/admin";

// The route calls createAdminClient() inside the handler; mock the module so no real
// Supabase (or the server-only guard it imports) is loaded. vi.hoisted lets the
// hoisted vi.mock factory reference the spy.
const { createAdminClientMock } = vi.hoisted(() => ({ createAdminClientMock: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdminClientMock }));

// Import AFTER the mock is registered.
const { GET } = await import("./route");

type Row = Record<string, unknown>;
type QueryResult = { data: Row[] | null; error: { message: string } | null };

interface QueryStub {
  select: () => QueryStub;
  delete: () => QueryStub;
  in: () => QueryStub;
  lt: () => QueryStub;
  order: () => QueryStub;
  limit: () => QueryStub;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// A chainable, awaitable stand-in for a PostgREST query builder: every method returns
// the same object, and awaiting it (via `then`) yields the configured result.
function queryStub(result: QueryResult): QueryStub {
  const stub = {} as QueryStub;
  stub.select = () => stub;
  stub.delete = () => stub;
  stub.in = () => stub;
  stub.lt = () => stub;
  stub.order = () => stub;
  stub.limit = () => stub;
  stub.then = (resolve) => Promise.resolve(result).then(resolve);
  return stub;
}

type AdminClient = ReturnType<typeof createAdminClient>;

// Minimal admin-client double covering the three tables/ops the route touches:
// profiles.select (existence guard), dev_otp_inbox.delete (hygiene), dev_otp_inbox.select (fetch).
function makeAdmin(opts: { profile: QueryResult; otp: QueryResult }): AdminClient {
  const profiles = queryStub(opts.profile);
  const otpSelect = queryStub(opts.otp);
  const otpDelete = queryStub({ data: null, error: null });
  const client = {
    from(table: string) {
      if (table === "profiles") return profiles;
      return { select: () => otpSelect, delete: () => otpDelete };
    },
  };
  return client as unknown as AdminClient;
}

function makeRequest(phone: string): NextRequest {
  const url = new URL(`http://localhost/api/dev/otp?phone=${encodeURIComponent(phone)}`);
  return { nextUrl: url } as unknown as NextRequest;
}

const freshOtp: QueryResult = {
  data: [{ otp: "123456", created_at: new Date().toISOString() }],
  error: null,
};

describe("GET /api/dev/otp — account-takeover guard (finding V3, restored V13)", () => {
  const originalAppEnv = process.env.NEXT_PUBLIC_APP_ENV;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_ENV = "preview"; // endpoint enabled in dev/preview only
    createAdminClientMock.mockReset();
  });
  afterEach(() => {
    if (originalAppEnv === undefined) delete process.env.NEXT_PUBLIC_APP_ENV;
    else process.env.NEXT_PUBLIC_APP_ENV = originalAppEnv;
  });

  it("withholds (404) for a REGISTERED account — profile row exists, not completed/active", async () => {
    // The new real account tier: status 'registered', registration_completed_at null.
    // Pre-fix the guard only checked completed/active, so it served this account's live
    // login code — an account-takeover oracle. This assertion fails on the old code.
    createAdminClientMock.mockReturnValue(
      makeAdmin({
        profile: {
          data: [{ id: "u1", status: "registered", registration_completed_at: null }],
          error: null,
        },
        otp: freshOtp,
      }),
    );
    const res = await GET(makeRequest("+995555000000"));
    expect(res.status).toBe(404);
  });

  it("serves the code when NO profile row exists (a genuine new signup)", async () => {
    // register() inserts the profile only AFTER OTP verification, so a real new signup
    // has no row at OTP time — the on-screen code must still render.
    createAdminClientMock.mockReturnValue(
      makeAdmin({ profile: { data: [], error: null }, otp: freshOtp }),
    );
    const res = await GET(makeRequest("+995555000001"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ otp: "123456" });
  });

  it("withholds (404) for a completed account (unchanged Phase-2 contract)", async () => {
    createAdminClientMock.mockReturnValue(
      makeAdmin({
        profile: {
          data: [
            {
              id: "u2",
              status: "profile_completed",
              registration_completed_at: new Date().toISOString(),
            },
          ],
          error: null,
        },
        otp: freshOtp,
      }),
    );
    const res = await GET(makeRequest("+995555000002"));
    expect(res.status).toBe(404);
  });

  it("withholds (404) for an active_member account (unchanged Phase-2 contract)", async () => {
    createAdminClientMock.mockReturnValue(
      makeAdmin({
        profile: {
          data: [{ id: "u3", status: "active_member", registration_completed_at: null }],
          error: null,
        },
        otp: freshOtp,
      }),
    );
    const res = await GET(makeRequest("+995555000003"));
    expect(res.status).toBe(404);
  });
});
