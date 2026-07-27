/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// The cleanups build their own service client from env. Intercept the constructor
// so these run against a scripted Supabase instead of staging — what's under test
// is what the cleanup does with the errors it gets back.
const createClient = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { fakeUserClient } from "./cleanup-test-support";
import { cleanupUsersByPhone, failIfAny, runCleanups, SWEEP_HINT } from "./cleanup-helpers";

const PHONES = ["+995550009928", "995550009928"];

describe("failIfAny", () => {
  test("stays silent when nothing failed", () => {
    expect(() => failIfAny("some cleanup", [], SWEEP_HINT)).not.toThrow();
  });

  test("names the cleanup, every failure, and the remedy", () => {
    let message = "";
    try {
      failIfAny("phase-4 e2e cleanup", ["first thing broke", "second thing broke"], SWEEP_HINT);
    } catch (e) {
      message = (e as Error).message;
    }
    // Playwright pins an afterAll throw on the last test in the file, so the label
    // has to come first or this reads as that test's own failure.
    expect(message).toMatch(/^phase-4 e2e cleanup/);
    expect(message).toContain("2 failure(s)");
    expect(message).toContain("first thing broke");
    expect(message).toContain("second thing broke");
    expect(message).toContain("sweep-staging-e2e.mjs --apply");
  });
});

describe("runCleanups", () => {
  // The reason this exists: hooks used to `await` two cleanups in a row, so the
  // first throw skipped the second and leaked the users it was meant to delete.
  test("runs every step even after an earlier one throws", async () => {
    const ran: string[] = [];
    const failing = async () => {
      ran.push("content");
      throw new Error("content cleanup failed");
    };
    const following = async () => {
      ran.push("users");
    };

    await expect(runCleanups([failing, following])).rejects.toThrow(/content cleanup failed/);
    expect(ran).toEqual(["content", "users"]);
  });

  test("reports every failed step, not just the first", async () => {
    const boom = (what: string) => async () => {
      throw new Error(`${what} broke`);
    };

    await expect(runCleanups([boom("first"), boom("second")])).rejects.toThrow(
      /first broke[\s\S]*second broke/,
    );
  });

  test("resolves when every step succeeds", async () => {
    await expect(runCleanups([async () => {}, async () => {}])).resolves.toBeUndefined();
  });
});

describe("cleanupUsersByPhone", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://staging.example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    createClient.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  test("resolves the given phones against profiles, then detaches memberships", async () => {
    const db = fakeUserClient({ profileIds: ["user-a"] });
    createClient.mockReturnValue(db.client);

    await cleanupUsersByPhone("phase-4 e2e cleanup", PHONES);

    expect(db.selected).toEqual([{ table: "profiles", column: "phone", values: PHONES }]);
    // Detaching the wrong table/column here would delete real rows, so pin both.
    expect(db.deleted).toEqual([
      { table: "memberships", column: "delegate_id", values: ["user-a"] },
    ]);
  });

  // A failed lookup finds no ids, so the delete loop has nothing to fail on — the
  // whole cleanup degrades to a silent no-op, the quietest leak of the three.
  test("rejects when the profile lookup fails, rather than quietly cleaning nothing", async () => {
    const db = fakeUserClient({ profileIds: ["user-a"], lookupError: { message: "JWT expired" } });
    createClient.mockReturnValue(db.client);

    await expect(cleanupUsersByPhone("phase-4 e2e cleanup", PHONES)).rejects.toThrow(
      /JWT expired[\s\S]*sweep-staging-e2e\.mjs/,
    );
    expect(db.attempted).toEqual([]);
  });

  // Siblings that CREATE data all refuse phones outside the 55 e2e block
  // (funnel-helpers seedCompletedMember/seedRegisteredMember/approveOwnDelegate).
  // This one DELETES, takes arbitrary strings, and is driven by an unvalidated
  // env var — it needs the guard more than they do, not less.
  test("refuses to delete phones outside the 55 e2e block", async () => {
    await expect(
      cleanupUsersByPhone("phase-4 e2e cleanup", ["+995599123456", "995599123456"]),
    ).rejects.toThrow(/refus/i);
    expect(createClient).not.toHaveBeenCalled();
  });

  test("refuses the whole batch when even one phone is out of block", async () => {
    await expect(
      cleanupUsersByPhone("phase-4 e2e cleanup", [...PHONES, "995599123456"]),
    ).rejects.toThrow(/995599123456/);
    expect(createClient).not.toHaveBeenCalled();
  });

  test("rejects when the membership detach fails", async () => {
    const db = fakeUserClient({
      profileIds: ["user-a"],
      detachError: { message: "permission denied for table memberships" },
    });
    createClient.mockReturnValue(db.client);

    await expect(cleanupUsersByPhone("phase-4 e2e cleanup", PHONES)).rejects.toThrow(
      /membership detach.*permission denied for table memberships/s,
    );
  });

  test("attempts every deletion and reports all failures, not just the first", async () => {
    const db = fakeUserClient({
      profileIds: ["user-a", "user-b", "user-c"],
      deleteUserErrors: { "user-a": { message: "boom a" }, "user-c": { message: "boom c" } },
    });
    createClient.mockReturnValue(db.client);

    // Both failures named, and user-b (between them) still got its attempt.
    await expect(cleanupUsersByPhone("journey e2e cleanup", PHONES)).rejects.toThrow(
      /user-a.*user-c/s,
    );
    expect(db.attempted).toEqual(["user-a", "user-b", "user-c"]);
  });

  test("resolves when every deletion succeeds", async () => {
    const db = fakeUserClient({ profileIds: ["user-a", "user-b"] });
    createClient.mockReturnValue(db.client);

    await expect(cleanupUsersByPhone("phase-4 e2e cleanup", PHONES)).resolves.toBeUndefined();
  });

  test("resolves without touching auth when no profile matches", async () => {
    const db = fakeUserClient({ profileIds: [] });
    createClient.mockReturnValue(db.client);

    await expect(cleanupUsersByPhone("phase-4 e2e cleanup", PHONES)).resolves.toBeUndefined();
    expect(db.attempted).toEqual([]);
  });

  // Local runs without staging credentials keep skipping rather than failing —
  // the e2e journeys themselves already fail loudly on missing creds.
  test("skips quietly when staging credentials are absent", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    await expect(cleanupUsersByPhone("phase-4 e2e cleanup", PHONES)).resolves.toBeUndefined();
    expect(createClient).not.toHaveBeenCalled();
  });
});
