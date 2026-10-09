/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import {
  fixturePassword,
  fixtureSessionFor,
  freshVisitorSession,
  isE2eFixturePhone,
  isPersonaPhone,
  OWNER_SMOKE_PHONES,
  resolvePersonaPhone,
  type FixtureAuthConfig,
} from "./fixture-auth";

const CONFIG: FixtureAuthConfig = {
  url: "https://orcxtbedkexoclbfgvzd.supabase.co",
  anonKey: "anon-key",
  serviceKey: "service-role-key",
};

beforeEach(() => createClient.mockReset());

describe("isE2eFixturePhone (unchanged e2e allow-list)", () => {
  it.each(["509000001", "509000004", "550001239"])("accepts %s", (phone) => {
    expect(isE2eFixturePhone(phone)).toBe(true);
  });

  it.each(["500000001", "509000005", "599123456", "", ...OWNER_SMOKE_PHONES])(
    "refuses %s",
    (phone) => {
      expect(isE2eFixturePhone(phone)).toBe(false);
    },
  );
});

describe("isPersonaPhone (preview test sign-in)", () => {
  it.each(["509000001", "500000001", "500001899"])("accepts seed phone %s", (phone) => {
    expect(isPersonaPhone(phone)).toBe(true);
  });

  it.each(["550001239", "509000005", "5000000011", "599123456", ...OWNER_SMOKE_PHONES])(
    "refuses %s",
    (phone) => {
      expect(isPersonaPhone(phone)).toBe(false);
    },
  );
});

describe("fixturePassword", () => {
  it("is stable per phone and key, and differs across phones", () => {
    expect(fixturePassword("509000001", "k")).toBe(fixturePassword("509000001", "k"));
    expect(fixturePassword("509000001", "k")).not.toBe(fixturePassword("509000002", "k"));
    expect(fixturePassword("509000001", "k")).toMatch(/^E2e-[0-9a-f]{32}!Aa1$/);
  });
});

describe("fixtureSessionFor", () => {
  it("refuses a phone its allow-list rejects before creating any client", async () => {
    await expect(fixtureSessionFor(CONFIG, "500000001")).rejects.toThrow(/fixture/i);
    await expect(fixtureSessionFor(CONFIG, "599123456", isPersonaPhone)).rejects.toThrow(
      /fixture/i,
    );
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("freshVisitorSession", () => {
  it("creates a Google-marked made-up account and signs it in", async () => {
    const createUser = vi.fn().mockResolvedValue({ data: { user: { id: "v1" } }, error: null });
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: { access_token: "a", refresh_token: "r" } },
      error: null,
    });
    createClient.mockImplementation((_url: string, key: string) =>
      key === "anon-key" ? { auth: { signInWithPassword } } : { auth: { admin: { createUser } } },
    );

    const session = await freshVisitorSession(CONFIG);

    expect(session).toEqual({ access_token: "a", refresh_token: "r" });
    const created = createUser.mock.calls[0]![0];
    expect(created.email).toMatch(/^preview-visitor\+[0-9a-f-]{36}@example\.invalid$/);
    expect(created.app_metadata).toEqual({
      provider: "google",
      providers: ["google"],
      preview_visitor: true,
    });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: created.email,
      password: created.password,
    });
  });
});

describe("resolvePersonaPhone", () => {
  function fakeDb(tables: {
    delegates: { id: string; slug: string; status: string }[];
    profiles: { id: string; phone: string; status: string }[];
  }) {
    createClient.mockImplementation(() => ({
      from: (table: "delegates" | "profiles") => {
        let rows: Record<string, string>[] = [...tables[table]];
        const query = {
          select: () => query,
          eq: (column: string, value: string) => {
            rows = rows.filter((row) => row[column] === value);
            return query;
          },
          like: (column: string, pattern: string) => {
            const prefix = pattern.replace(/%$/, "");
            rows = rows.filter((row) => row[column]?.startsWith(prefix));
            return query;
          },
          order: (column: string) => {
            rows = [...rows].sort((a, b) => (a[column] ?? "").localeCompare(b[column] ?? ""));
            return query;
          },
          limit: async (n: number) => ({ data: rows.slice(0, n), error: null }),
          single: async () => ({ data: rows[0] ?? null, error: rows[0] ? null : { message: "0" } }),
          then: (resolve: (value: { data: typeof rows; error: null }) => void) =>
            resolve({ data: rows, error: null }),
        };
        return query;
      },
    }));
  }

  const tables = {
    delegates: [
      { id: "d1", slug: "giorgi-maisuradze", status: "approved" },
      { id: "d2", slug: "tamar-kavtaradze", status: "approved" },
    ],
    profiles: [
      { id: "d1", phone: "+995500000001", status: "active_member" },
      { id: "d2", phone: "+995500000002", status: "active_member" },
      { id: "m1", phone: "+995500000013", status: "active_member" },
      { id: "r1", phone: "+995500000012", status: "registered" },
      { id: "owner", phone: "+995599123456", status: "active_member" },
    ],
  };

  it("uses the canonical super_admin for the admin persona", async () => {
    await expect(resolvePersonaPhone(CONFIG, "admin")).resolves.toBe("509000001");
  });

  it("finds the first roster delegate", async () => {
    fakeDb(tables);
    await expect(resolvePersonaPhone(CONFIG, "delegate")).resolves.toBe("500000001");
  });

  it("finds an active seed member who is not a delegate", async () => {
    fakeDb(tables);
    await expect(resolvePersonaPhone(CONFIG, "member")).resolves.toBe("500000013");
  });
});
