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
type ChainCall = { method: string; args: unknown[] };

interface QueryStub {
  select: (...args: unknown[]) => QueryStub;
  delete: (...args: unknown[]) => QueryStub;
  in: (...args: unknown[]) => QueryStub;
  lt: (...args: unknown[]) => QueryStub;
  gt: (...args: unknown[]) => QueryStub;
  gte: (...args: unknown[]) => QueryStub;
  order: (...args: unknown[]) => QueryStub;
  limit: (...args: unknown[]) => QueryStub;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
}

// A chainable, awaitable stand-in for a PostgREST query builder: every method returns
// the same object, and awaiting it (via `then`) yields the configured result. `onCall`
// records the filter chain so a test can assert HOW the row was asked for, not just
// what came back.
function queryStub(result: QueryResult, onCall?: (call: ChainCall) => void): QueryStub {
  const stub = {} as QueryStub;
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      onCall?.({ method, args });
      return stub;
    };
  stub.select = record("select");
  stub.delete = record("delete");
  stub.in = record("in");
  stub.lt = record("lt");
  stub.gt = record("gt");
  stub.gte = record("gte");
  stub.order = record("order");
  stub.limit = record("limit");
  stub.then = (resolve) => Promise.resolve(result).then(resolve);
  return stub;
}

type AdminClient = ReturnType<typeof createAdminClient>;

/** What the route did with the service-role key, as seen from the DB side. */
interface AdminSpy {
  /** one per poll iteration — the physical cost that any timing gap is made of */
  otpReads: number;
  /** service-role WRITES driven by this request */
  otpDeletes: number;
  /** the filter chain of the inbox read */
  readChain: ChainCall[];
}
const newSpy = (): AdminSpy => ({ otpReads: 0, otpDeletes: 0, readChain: [] });

// Minimal admin-client double covering the three tables/ops the route touches:
// profiles.select (existence guard), dev_otp_inbox.delete (hygiene), dev_otp_inbox.select (fetch).
function makeAdmin(opts: { profile: QueryResult; otp: QueryResult; spy?: AdminSpy }): AdminClient {
  const spy = opts.spy;
  const profiles = queryStub(opts.profile);
  const otpSelect = queryStub(opts.otp, (call) => spy?.readChain.push(call));
  const otpDelete = queryStub({ data: null, error: null });
  const client = {
    from(table: string) {
      if (table === "profiles") return profiles;
      return {
        select: (...args: unknown[]) => {
          if (spy) spy.otpReads++;
          return otpSelect.select(...args);
        },
        delete: (...args: unknown[]) => {
          if (spy) spy.otpDeletes++;
          return otpDelete.delete(...args);
        },
      };
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
const noOtp: QueryResult = { data: [], error: null };
const noProfile: QueryResult = { data: [], error: null };
const hasProfile: QueryResult = {
  data: [{ id: "u1", status: "registered", registration_completed_at: null }],
  error: null,
};

// The route's poll shape. The inbox is read once per attempt with a sleep between
// attempts, so a failure that polls costs POLL_BUDGET_MS and one that short-circuits
// costs nothing — that gap IS the timing oracle.
const POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 500;
const POLL_BUDGET_MS = POLL_ATTEMPTS * POLL_INTERVAL_MS;
const CODE_TTL_MS = 60 * 60 * 1000;

type Res = Awaited<ReturnType<typeof GET>>;

/**
 * Calls the route on a fake clock and reports when it answered, in virtual ms.
 * Fake timers make the measurement exact and free: the handler's real sleeps are
 * never slept, and `advanceTimersByTimeAsync` flushes microtasks between timers so
 * every awaited query still settles in order. A handler that answers without polling
 * settles at t+0; one that polls settles at t+POLL_BUDGET_MS.
 */
async function timedGet(
  phone: string,
): Promise<{ res: Res; elapsedMs: number; startedAt: number }> {
  vi.useFakeTimers();
  try {
    const startedAt = Date.now();
    let finishedAt: number | null = null;
    const pending = GET(makeRequest(phone)).then((res) => {
      finishedAt = Date.now();
      return res;
    });
    await vi.advanceTimersByTimeAsync(POLL_BUDGET_MS + POLL_INTERVAL_MS);
    const res = await pending;
    return { res, elapsedMs: (finishedAt ?? Date.now()) - startedAt, startedAt };
  } finally {
    vi.useRealTimers();
  }
}

/** The lower bound the inbox read was filtered on, or null if it was unbounded. */
function freshnessBound(chain: ChainCall[]): number | null {
  const call = chain.find(
    (c) => (c.method === "gte" || c.method === "gt") && c.args[0] === "created_at",
  );
  return typeof call?.args[1] === "string" ? new Date(call.args[1]).getTime() : null;
}

function useEnabledEnv(): void {
  const originalAppEnv = process.env.NEXT_PUBLIC_APP_ENV;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_ENV = "preview"; // endpoint enabled in dev/preview only
    createAdminClientMock.mockReset();
  });
  afterEach(() => {
    if (originalAppEnv === undefined) delete process.env.NEXT_PUBLIC_APP_ENV;
    else process.env.NEXT_PUBLIC_APP_ENV = originalAppEnv;
  });
}

describe("GET /api/dev/otp — account-takeover guard (finding V3, restored V13)", () => {
  useEnabledEnv();

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
    const { res } = await timedGet("+995555000000");
    expect(res.status).toBe(404);
  });

  it("serves the code when NO profile row exists (a genuine new signup)", async () => {
    // register() inserts the profile only AFTER OTP verification, so a real new signup
    // has no row at OTP time — the on-screen code must still render.
    createAdminClientMock.mockReturnValue(
      makeAdmin({ profile: { data: [], error: null }, otp: freshOtp }),
    );
    const { res } = await timedGet("+995555000001");
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
    const { res } = await timedGet("+995555000002");
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
    const { res } = await timedGet("+995555000003");
    expect(res.status).toBe(404);
  });
});

/**
 * The account-existence oracle (audit §18.1 body / §18.2 timing, proven live on the
 * production URL: `has-account 404 {"error":"not found"}` in ~1s versus `no-account 404
 * {"error":"no otp"}` in ~7s). Two independent channels answer "does this phone number
 * have an account here?" to any anonymous stranger, and closing one leaves the other
 * intact. On a civic platform whose membership is the sensitive fact, that is the
 * disclosure. Both failure paths must be indistinguishable: same status, same bytes,
 * same cost.
 */
describe("GET /api/dev/otp — account-existence oracle (audit §18.1, §18.2)", () => {
  useEnabledEnv();

  /** phone WITH an account and no pending code — audit case C */
  async function hasAccount(spy?: AdminSpy) {
    createAdminClientMock.mockReturnValue(makeAdmin({ profile: hasProfile, otp: noOtp, spy }));
    return timedGet("+995555000010");
  }
  /** phone with NO account and no pending code — audit case D */
  async function noAccount(spy?: AdminSpy) {
    createAdminClientMock.mockReturnValue(makeAdmin({ profile: noProfile, otp: noOtp, spy }));
    return timedGet("+995555000011");
  }

  it("answers both failure paths with byte-identical status and body (§18.1)", async () => {
    const has = await hasAccount();
    const not = await noAccount();
    const hasBody = await has.res.text();
    const notBody = await not.res.text();

    expect(has.res.status).toBe(not.res.status);
    expect(hasBody).toBe(notBody);
    // Pinned, not incidental: the audit instrument grades the account-takeover census
    // cell on exactly this body, and the disabled-endpoint 404 uses it too.
    expect(hasBody).toBe('{"error":"not found"}');
  });

  it("spends the same time on both failure paths (§18.2 — survives fixing the body)", async () => {
    const hasSpy = newSpy();
    const notSpy = newSpy();
    const has = await hasAccount(hasSpy);
    const not = await noAccount(notSpy);

    // Virtual time: the sleeps. The audit's live threshold is a 250ms gap; on a fake
    // clock the two paths must be exactly equal, so any real-world gap is network noise.
    expect(has.elapsedMs).toBe(not.elapsedMs);
    // Round-trips: the other half of real-world latency. Equal sleeps with unequal
    // query counts would still leak a measurable difference over the wire.
    expect(hasSpy.otpReads).toBe(notSpy.otpReads);
    expect(hasSpy.otpReads).toBe(POLL_ATTEMPTS);
  });

  it("keeps withholding, at the same cost, when a live code IS waiting for that account", async () => {
    // The attacker chooses the inbox state: triggering a send for the victim's number
    // puts a fresh code there. If the poll broke out early on finding one, the withheld
    // answer would come back fast again — the timing oracle restored for exactly the
    // numbers that matter. Withholding must cost the full budget, not stop at the row.
    const spy = newSpy();
    createAdminClientMock.mockReturnValue(makeAdmin({ profile: hasProfile, otp: freshOtp, spy }));
    const { res, elapsedMs } = await timedGet("+995555000012");

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('{"error":"not found"}');
    expect(elapsedMs).toBe(POLL_BUDGET_MS);
    expect(spy.otpReads).toBe(POLL_ATTEMPTS);
  });

  it("drives no service-role write on either failure path, and never reads a stale code", async () => {
    // Audit §18.3: an anonymous GET ran a service-role DELETE before any check. Nothing
    // an unauthenticated stranger does should reach a privileged write. The delete also
    // used to be what kept expired codes from being served, so the read carries that
    // guarantee itself now — as a filter, which no longer races the read.
    const hasSpy = newSpy();
    const notSpy = newSpy();
    const has = await hasAccount(hasSpy);
    const not = await noAccount(notSpy);

    expect(hasSpy.otpDeletes).toBe(0);
    expect(notSpy.otpDeletes).toBe(0);
    expect(freshnessBound(hasSpy.readChain)).toBe(has.startedAt - CODE_TTL_MS);
    expect(freshnessBound(notSpy.readChain)).toBe(not.startedAt - CODE_TTL_MS);
  });

  it("still prunes expired codes on the path that actually serves one", async () => {
    // Hygiene is not dropped, only moved behind the outcome that proves a real send:
    // 200 is reachable only for a phone that has no account and a code already waiting.
    const spy = newSpy();
    createAdminClientMock.mockReturnValue(makeAdmin({ profile: noProfile, otp: freshOtp, spy }));
    const { res } = await timedGet("+995555000013");

    expect(res.status).toBe(200);
    expect(spy.otpDeletes).toBe(1);
  });
});
