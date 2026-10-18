/**
 * Test doubles for the admin server-action and route tests. NOT production code:
 * imported only by `*.test.ts` files under app/(admin)/admin. The leading
 * underscore keeps the folder out of Next's routing.
 *
 * The fake session client records every call the code under test makes, so a
 * test can assert WHAT was asked of the database (which RPC, which arguments,
 * which table) rather than what the fake handed back. Results are produced by
 * the test's handlers; anything unhandled resolves to `{ data: null, error: null }`.
 */
import { beforeEach, vi, type Mock } from "vitest";

export interface DbError {
  message: string;
  code?: string;
}
export interface DbResult {
  data: unknown;
  error: DbError | null;
}
export interface ChainStep {
  method: string;
  args: unknown[];
}
export interface DbCall {
  kind: "rpc" | "from";
  /** RPC name or table/view name */
  name: string;
  /** RPC arguments (undefined for table reads) */
  args: unknown;
  /** the query-builder chain after `.from()` (select/eq/insert/...) */
  chain: ChainStep[];
}

export interface FakeHandlers {
  rpc?: (name: string, args: unknown) => DbResult | undefined;
  from?: (table: string, chain: readonly ChainStep[]) => DbResult | undefined;
}

const EMPTY: DbResult = { data: null, error: null };

/** What PostgREST returns when a plpgsql function runs `raise exception '<token>'`. */
export function raised(token: string, code = "P0001"): DbResult {
  return { data: null, error: { message: token, code } };
}

export const ok = (data: unknown = null): DbResult => ({ data, error: null });

/**
 * A chainable, awaitable stand-in for a PostgREST builder. Every method records
 * itself and returns the same builder; awaiting resolves the handler's result,
 * computed only then so it sees the whole chain.
 */
function chainable(call: DbCall, resolve: () => DbResult): unknown {
  const builder: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (onFulfilled: (v: DbResult) => unknown, onRejected?: (e: unknown) => unknown) =>
            Promise.resolve(resolve()).then(onFulfilled, onRejected);
        }
        return (...args: unknown[]) => {
          call.chain.push({ method: String(prop), args });
          return builder;
        };
      },
    },
  );
  return builder;
}

/** The signed-in user every fake session reports unless a test says otherwise. */
export const FAKE_SESSION_USER_ID = "22222222-2222-4222-8222-222222222222";

export interface FakeSession {
  /** hand this to the mocked createServerSupabase */
  client: unknown;
  calls: DbCall[];
  rpcCalls(): DbCall[];
  tableCalls(): DbCall[];
  /** the session's auth.signOut double (member self-deletion signs the caller out) */
  signOut: Mock;
  /** the session's auth.getUser double: FAKE_SESSION_USER_ID by default */
  getUser: Mock;
}

export function fakeSession(handlers: FakeHandlers = {}): FakeSession {
  const calls: DbCall[] = [];
  const signOut = vi.fn<(options?: unknown) => Promise<{ error: null }>>(async () => ({
    error: null,
  }));
  const getUser = vi.fn<() => Promise<{ data: { user: { id: string } | null }; error: unknown }>>(
    async () => ({ data: { user: { id: FAKE_SESSION_USER_ID } }, error: null }),
  );
  const client = {
    auth: { signOut, getUser },
    rpc(name: string, args?: unknown) {
      calls.push({ kind: "rpc", name, args, chain: [] });
      return Promise.resolve(handlers.rpc?.(name, args) ?? EMPTY);
    },
    from(table: string) {
      const call: DbCall = { kind: "from", name: table, args: undefined, chain: [] };
      calls.push(call);
      return chainable(call, () => handlers.from?.(table, call.chain) ?? EMPTY);
    },
  };
  return {
    client,
    calls,
    rpcCalls: () => calls.filter((c) => c.kind === "rpc"),
    tableCalls: () => calls.filter((c) => c.kind === "from"),
    signOut,
    getUser,
  };
}

/**
 * Per-file wiring for the admin tests (the vi.mock calls stay in each file,
 * because vitest hoists them per module). Registers a beforeEach that clears
 * every mock and installs a WORKING service-role decoy — code that wrongly
 * reached for the service role would succeed, so only the tests' "never
 * called" assertions can catch it. Returns `session(handlers)`, which installs
 * a fresh fake session client and hands it back for assertions.
 */
export function adminTestHarness(
  mocks: { createServerSupabase: Mock; createAdminClient: Mock },
  serviceRoleDecoy: () => unknown = () => fakeSession({ rpc: () => ok() }).client,
): (handlers?: FakeHandlers) => FakeSession {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAdminClient.mockReturnValue(serviceRoleDecoy());
  });
  return (handlers = {}) => {
    const s = fakeSession(handlers);
    mocks.createServerSupabase.mockResolvedValue(s.client);
    return s;
  };
}

export interface StorageCall {
  bucket: string;
  method: string;
  args: unknown[];
}

/**
 * Service-role client double: storage only (the one thing admin actions use it for). `list`
 * answers with every name in `listed`, whatever the search: the code under test must filter
 * by prefix itself rather than trust the server's match.
 */
export function fakeAdminClient(
  opts: {
    uploadError?: DbError;
    listed?: readonly string[];
    listError?: DbError;
    removeError?: DbError;
  } = {},
): {
  client: unknown;
  storageCalls: StorageCall[];
} {
  const storageCalls: StorageCall[] = [];
  const client = {
    storage: {
      from(bucket: string) {
        const record = (method: string, args: unknown[]) =>
          storageCalls.push({ bucket, method, args });
        return {
          upload: (...args: unknown[]) => {
            record("upload", args);
            return Promise.resolve({ data: {}, error: opts.uploadError ?? null });
          },
          getPublicUrl: (...args: unknown[]) => {
            record("getPublicUrl", args);
            return { data: { publicUrl: `https://cdn.test/${bucket}/${String(args[0])}` } };
          },
          list: (...args: unknown[]) => {
            record("list", args);
            return Promise.resolve(
              opts.listError
                ? { data: null, error: opts.listError }
                : { data: (opts.listed ?? []).map((name) => ({ name })), error: null },
            );
          },
          remove: (...args: unknown[]) => {
            record("remove", args);
            return Promise.resolve({ data: [], error: opts.removeError ?? null });
          },
        };
      },
    },
  };
  return { client, storageCalls };
}
