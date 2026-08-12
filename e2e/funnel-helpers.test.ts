/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { createClient, installSupabaseSession, playwrightExpect, toBeVisible, toHaveURL } =
  vi.hoisted(() => ({
    createClient: vi.fn(),
    installSupabaseSession: vi.fn(),
    playwrightExpect: vi.fn(),
    toBeVisible: vi.fn(),
    toHaveURL: vi.fn(),
  }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@playwright/test", () => ({ expect: playwrightExpect }));
vi.mock("./otp-helpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./otp-helpers")>()),
  installSupabaseSession,
}));

import { fakeUserClient } from "./cleanup-test-support";
import {
  cleanupJourneyUsers,
  cleanupGoogleBackedTestUsers,
  cleanupLoginUser,
  createGoogleBackedTestUser,
  approveOwnDelegate,
  fillMembershipProfile,
  getSeededReferral,
  JOURNEY,
  journeyPhone,
  LOGIN_PHONE,
  passRegistration,
  seedCompletedMember,
  seedPendingDelegate,
  seedRegisteredMember,
} from "./funnel-helpers";

// Derived from the module, never hardcoded: funnel-helpers reads E2E_TEST_PHONE at
// module load, so vi.stubEnv cannot reach it and a literal here would invert for
// anyone who has that variable exported to reproduce a CI run locally.
const LOGIN_AUTH_PHONE = `995${LOGIN_PHONE}`; // auth stores phones without '+'

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://staging.example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  vi.stubEnv("NEXT_PUBLIC_APP_ENV", "preview");
  createClient.mockReset();
  installSupabaseSession.mockReset();
  playwrightExpect.mockReset();
  toBeVisible.mockReset();
  toHaveURL.mockReset();
  playwrightExpect.mockReturnValue({ toBeVisible, toHaveURL });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("createGoogleBackedTestUser", () => {
  test("creates the exact synthetic Google identity, signs it in, and installs its session", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const page = { fixture: "page" };
    const createdUser = { id: "google-user-1" };
    const createdSession = {
      access_token: "access-token",
      refresh_token: "refresh-token",
    };
    const createUser = vi.fn().mockResolvedValue({
      data: { user: createdUser },
      error: null,
    });
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: createdSession },
      error: null,
    });
    createClient.mockImplementation((_url: string, key: string) =>
      key === "service-role-key"
        ? { auth: { admin: { createUser } } }
        : { auth: { signInWithPassword } },
    );

    const result = await createGoogleBackedTestUser(page as never, "550001230");

    expect(createUser).toHaveBeenCalledWith({
      email: "e2e+550001230@example.invalid",
      password: expect.stringMatching(/^E2e-[A-Za-z0-9-]+!Aa1$/),
      email_confirm: true,
      app_metadata: { provider: "google", providers: ["google"], e2e: true },
    });
    const password = createUser.mock.calls[0]![0].password as string;
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "e2e+550001230@example.invalid",
      password,
    });
    expect(installSupabaseSession).toHaveBeenCalledWith(page, createdSession);
    expect(result).toEqual({ id: "google-user-1" });
    expect(JSON.stringify(result)).not.toContain(password);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  test("fails before any Supabase client or user creation outside development and preview", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");

    await expect(createGoogleBackedTestUser({} as never, "550001230")).rejects.toThrow(
      /development|preview/i,
    );

    expect(createClient).not.toHaveBeenCalled();
    expect(installSupabaseSession).not.toHaveBeenCalled();
  });
});

describe("cleanupGoogleBackedTestUsers", () => {
  test("detaches dependent rows and deletes only the requested synthetic auth users", async () => {
    const detach = vi.fn().mockResolvedValue({ error: null });
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    createClient.mockReturnValue({
      from: (table: string) => {
        expect(table).toBe("memberships");
        return { delete: () => ({ in: detach }) };
      },
      auth: {
        admin: {
          listUsers: () =>
            Promise.resolve({
              data: {
                users: [
                  { id: "ours", email: "e2e+550001230@example.invalid" },
                  { id: "not-ours", email: "e2e+550009999@example.invalid" },
                ],
              },
              error: null,
            }),
          deleteUser,
        },
      },
    });

    await cleanupGoogleBackedTestUsers(["550001230"]);

    expect(detach).toHaveBeenCalledWith("delegate_id", ["ours"]);
    expect(deleteUser).toHaveBeenCalledWith("ours");
    expect(deleteUser).not.toHaveBeenCalledWith("not-ours");
  });

  test("refuses unsafe fixture slots before listing or deleting users", async () => {
    await expect(cleanupGoogleBackedTestUsers(["599123456"])).rejects.toThrow(/refus/i);
    expect(createClient).not.toHaveBeenCalled();
  });

  test("cannot list or delete synthetic users in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");

    await expect(cleanupGoogleBackedTestUsers(["550001230"])).rejects.toThrow(
      /development|preview/i,
    );

    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("seedRegisteredMember", () => {
  test("adds cabinet data to the existing Google auth user without creating another identity", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const createUser = vi.fn();
    createClient.mockReturnValue({
      auth: { admin: { createUser } },
      from: () => ({ insert }),
    });

    await seedRegisteredMember({
      userId: "google-user-1",
      phone: "550001230",
      firstName: "ნინო",
      lastName: "ტესტი",
      personalId: "95500012300",
    });

    expect(createUser).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith({
      id: "google-user-1",
      first_name: "ნინო",
      last_name: "ტესტი",
      phone: "+995550001230",
      personal_id: "95500012300",
      status: "registered",
    });
  });
});

describe("suite-wide fixture environment guard", () => {
  const registered = {
    userId: "google-user-1",
    phone: "550001230",
    firstName: "ნინო",
    lastName: "ტესტი",
    personalId: "95500012300",
  };
  const completed = {
    phone: "550001230",
    firstName: "ნინო",
    lastName: "ტესტი",
    personalId: "95500012300",
  };

  test.each([undefined, "test", "staging", "production", "Preview"])(
    "all service-backed fixture entry points reject %s before client or database work",
    async (appEnv) => {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", appEnv);
      vi.stubEnv("PHONE_VERIFICATION_PROVIDER", "test");

      const calls = [
        () => cleanupLoginUser(),
        () => cleanupJourneyUsers(),
        () => seedRegisteredMember(registered),
        () => seedCompletedMember(completed),
        () => seedPendingDelegate(completed),
        () => approveOwnDelegate("550001230"),
        () => getSeededReferral(),
        () => fillMembershipProfile({} as never, { regionLabel: "თბილისი" }),
        () =>
          passRegistration({} as never, {
            phone: "550001230",
            firstName: "ნინო",
            lastName: "ტესტი",
          }),
      ];

      for (const call of calls) {
        await expect(call()).rejects.toThrow(/development|preview/i);
      }
      expect(createClient).not.toHaveBeenCalled();
      expect(installSupabaseSession).not.toHaveBeenCalled();
    },
  );
});

describe("passRegistration", () => {
  test("refuses to start when the paid provider could be reached", async () => {
    vi.stubEnv("PHONE_VERIFICATION_PROVIDER", "verify_ge");

    await expect(
      passRegistration({} as never, {
        phone: "550001230",
        firstName: "ნინო",
        lastName: "ტესტი",
      }),
    ).rejects.toThrow(/PHONE_VERIFICATION_PROVIDER=test/);

    expect(createClient).not.toHaveBeenCalled();
  });

  test("creates the Google fixture before /join and uses only the deterministic provider code", async () => {
    vi.stubEnv("PHONE_VERIFICATION_PROVIDER", "test");
    const createUser = vi.fn().mockResolvedValue({
      data: { user: { id: "google-user-1" } },
      error: null,
    });
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: { access_token: "access", refresh_token: "refresh" } },
      error: null,
    });
    createClient.mockImplementation((_url: string, key: string) =>
      key === "service-role-key"
        ? { auth: { admin: { createUser } } }
        : { auth: { signInWithPassword } },
    );
    const goto = vi.fn().mockResolvedValue(undefined);
    const fill = vi.fn().mockResolvedValue(undefined);
    const click = vi.fn().mockResolvedValue(undefined);
    const page = {
      goto,
      getByLabel: vi.fn().mockReturnValue({ fill }),
      getByRole: vi.fn().mockReturnValue({ click }),
      getByTestId: vi.fn().mockReturnValue({ fill }),
    };

    await passRegistration(page as never, {
      phone: "550001230",
      firstName: "ნინო",
      lastName: "ტესტი",
      refCode: "ABC123",
    });

    expect(createUser.mock.invocationCallOrder[0]).toBeLessThan(goto.mock.invocationCallOrder[0]!);
    expect(goto).toHaveBeenCalledWith("/join?ref=ABC123");
    expect(page.getByRole).toHaveBeenCalledWith("button", { name: "კოდის მიღება" });
    expect(page.getByTestId).toHaveBeenCalledWith("otp-0");
    expect(fill).toHaveBeenCalledWith("123456");
  });
});

// Shared mechanics are covered in cleanup-helpers.test.ts; this wrapper owns only
// the journey-slot phone derivation.
describe("cleanupJourneyUsers", () => {
  test("covers every journey slot in both stored phone forms", async () => {
    const db = fakeUserClient({ profileIds: [] });
    createClient.mockReturnValue(db.client);

    await cleanupJourneyUsers();

    const queried = db.phonesQueried();
    expect(queried).toHaveLength(Object.keys(JOURNEY).length * 2);
    for (const slot of Object.values(JOURNEY)) {
      expect(queried).toContain(`+995${journeyPhone(slot)}`);
      expect(queried).toContain(`995${journeyPhone(slot)}`);
    }
  });

  test("surfaces a cleanup failure to the caller", async () => {
    const db = fakeUserClient({
      profileIds: ["journey-a"],
      deleteUserErrors: { "journey-a": { message: "still referenced by payments" } },
    });
    createClient.mockReturnValue(db.client);

    await expect(cleanupJourneyUsers()).rejects.toThrow(/journey-a.*still referenced by payments/s);
  });
});

// cleanupLoginUser is NOT built on cleanupUsersByPhone: the login orphan has no
// profiles row, so it is found by paging auth.admin.listUsers. Its own tests.
describe("cleanupLoginUser", () => {
  test("rejects when the login orphan cannot be deleted", async () => {
    createClient.mockReturnValue({
      auth: {
        admin: {
          listUsers: () =>
            Promise.resolve({
              data: { users: [{ id: "orphan-1", phone: LOGIN_AUTH_PHONE }] },
              error: null,
            }),
          deleteUser: () => Promise.resolve({ error: { message: "user is referenced" } }),
        },
      },
    });

    await expect(cleanupLoginUser()).rejects.toThrow(/orphan-1.*user is referenced/s);
  });

  // The old code returned on a listing error, so a broken lookup was indistinguishable
  // from "no orphan to clean" — the cleanup reported success having done nothing.
  test("rejects when the user listing fails, rather than reading as nothing-to-clean", async () => {
    createClient.mockReturnValue({
      auth: {
        admin: {
          listUsers: () =>
            Promise.resolve({ data: { users: [] }, error: { message: "service unavailable" } }),
          deleteUser: () => Promise.resolve({ error: null }),
        },
      },
    });

    await expect(cleanupLoginUser()).rejects.toThrow(/service unavailable/);
  });

  // Same hole cleanupUsersByPhone guards against, via a different path: this one
  // finds its victim by scanning auth rather than by looking up profiles, but the
  // phone still comes from the unvalidated E2E_TEST_PHONE. LOGIN_PHONE is captured
  // at module load, so the env has to be stubbed before a fresh import.
  test("refuses to delete when E2E_TEST_PHONE points outside the 55 e2e block", async () => {
    vi.stubEnv("E2E_TEST_PHONE", "599123456");
    vi.resetModules();
    const fresh = await import("./funnel-helpers");
    const deleted: string[] = [];
    createClient.mockReturnValue({
      auth: {
        admin: {
          listUsers: () =>
            Promise.resolve({
              data: { users: [{ id: "a-real-person", phone: "995599123456" }] },
              error: null,
            }),
          deleteUser: (id: string) => {
            deleted.push(id);
            return Promise.resolve({ error: null });
          },
        },
      },
    });

    await expect(fresh.cleanupLoginUser()).rejects.toThrow(/refus/i);
    expect(deleted).toEqual([]);
  });

  test("resolves when no orphan is present", async () => {
    createClient.mockReturnValue({
      auth: {
        admin: {
          listUsers: () =>
            Promise.resolve({ data: { users: [{ id: "x", phone: "995500000001" }] }, error: null }),
          deleteUser: () => Promise.resolve({ error: null }),
        },
      },
    });

    await expect(cleanupLoginUser()).resolves.toBeUndefined();
  });
});
