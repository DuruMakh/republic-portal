/** @vitest-environment node */
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { fakeUserClient } from "./cleanup-test-support";
import { cleanupPhase4Users, phase4Phone } from "./admin-helpers";

// The cleanup mechanics are covered once, against the shared helper, in
// cleanup-helpers.test.ts. All this wrapper still owns is the phone derivation —
// so that is what it is tested on. Phones come from phase4Phone rather than
// literals: admin-helpers reads E2E_TEST_PHONE at module load, so a hardcoded
// expectation would flip for anyone with that variable exported.
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://staging.example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  createClient.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

test("looks up every requested slot in both stored phone forms", async () => {
  const db = fakeUserClient({ profileIds: [] });
  createClient.mockReturnValue(db.client);

  await cleanupPhase4Users([5, 6]);

  const queried = db.phonesQueried();
  expect(queried).toHaveLength(4);
  for (const k of [5, 6]) {
    expect(queried).toContain(`+995${phase4Phone(k)}`);
    expect(queried).toContain(`995${phase4Phone(k)}`); // auth stores phones without '+'
  }
});

test("surfaces a cleanup failure to the caller", async () => {
  const db = fakeUserClient({
    profileIds: ["user-a"],
    deleteUserErrors: { "user-a": { message: "still referenced by payments" } },
  });
  createClient.mockReturnValue(db.client);

  await expect(cleanupPhase4Users([5])).rejects.toThrow(/still referenced by payments/);
});
