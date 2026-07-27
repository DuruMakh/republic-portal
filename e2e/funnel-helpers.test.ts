/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { fakeUserClient } from "./cleanup-test-support";
import {
  cleanupJourneyUsers,
  cleanupLoginUser,
  JOURNEY,
  journeyPhone,
  LOGIN_PHONE,
} from "./funnel-helpers";

// Derived from the module, never hardcoded: funnel-helpers reads E2E_TEST_PHONE at
// module load, so vi.stubEnv cannot reach it and a literal here would invert for
// anyone who has that variable exported to reproduce a CI run locally.
const LOGIN_AUTH_PHONE = `995${LOGIN_PHONE}`; // auth stores phones without '+'

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://staging.example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  createClient.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

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
