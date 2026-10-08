// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { csvEscape, memberExportHeaders } from "@/lib/csv";
import { fakeSession, ok, type DbResult } from "../../_test-utils/fake-supabase";

/**
 * The roster export is the bulk-exfiltration surface: every member's name and
 * phone, and — for super_admin only — personal IDs (ADR-014, spec decision #6).
 * The route gates app-side (finance/super_admin; IDs super_admin-only) BEFORE any
 * client exists, and the admin_export_members RPC re-checks both and audits
 * member.export in-DB (pinned in lib/security/schema-guards.test.ts). The CSV
 * must neutralize spreadsheet formulas in member-supplied text (lib/csv).
 */

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  getAdminRoles: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: mocks.createServerSupabase,
  getAdminRoles: mocks.getAdminRoles,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

const { GET } = await import("./route");

const PERSONAL_ID = "01001099999";
const ID_HEADER = memberExportHeaders(true).at(-1)!;

const row = (over: Record<string, unknown> = {}) => ({
  firstName: "Nino",
  lastName: "Beridze",
  phone: "+995555123456",
  regionNameKa: null,
  cityNameKa: null,
  delegateName: null,
  status: "registered",
  tier: null,
  referenceCode: "GR-ABCDEF",
  registeredAt: "2026-10-01",
  ...over,
});

function exportAs(roles: string[], rpcResult: DbResult = ok([row()])) {
  mocks.getAdminRoles.mockResolvedValue(roles);
  const s = fakeSession({ rpc: () => rpcResult, from: () => ok([]) });
  mocks.createServerSupabase.mockResolvedValue(s.client);
  return s;
}

const get = (query = "") => GET(new Request(`http://localhost/admin/members/export${query}`));

/** CSV lines without the BOM. */
async function lines(res: Response): Promise<string[]> {
  return (await res.text())
    .replace(/^\uFEFF/, "")
    .trimEnd()
    .split("\r\n");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /admin/members/export — who may export", () => {
  it.each([[[]], [["verifier"]], [["editor"]], [["verifier", "editor"]]])(
    "refuses roles %j with 403 before any client exists",
    async (roles) => {
      const s = exportAs(roles);
      const res = await get();
      expect(res.status).toBe(403);
      expect(mocks.createServerSupabase).not.toHaveBeenCalled();
      expect(mocks.createAdminClient).not.toHaveBeenCalled();
      expect(s.calls).toEqual([]);
    },
  );

  it.each([[["finance"]], [["super_admin"]]])("lets %j export", async (roles) => {
    const s = exportAs(roles);
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(s.rpcCalls().map((c) => c.name)).toEqual(["admin_export_members"]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});

describe("GET /admin/members/export — personal IDs are super_admin-only", () => {
  it("refuses finance asking for IDs with 403, before any client exists", async () => {
    const s = exportAs(["finance"]);
    const res = await get("?includeIds=1");
    expect(res.status).toBe(403);
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
    expect(s.calls).toEqual([]);
  });

  it("finance's export asks the RPC for no IDs and carries no ID column, even if one came back", async () => {
    const s = exportAs(["finance"], ok([row({ personalId: PERSONAL_ID })]));
    const res = await get();
    expect(s.rpcCalls()[0]!.args).toMatchObject({ p_include_ids: false });
    const [header, ...body] = await lines(res);
    expect(header).toBe(memberExportHeaders(false).map(csvEscape).join(","));
    expect(header).not.toContain(ID_HEADER);
    expect(body.join("\n")).not.toContain(PERSONAL_ID);
  });

  it("super_admin asking for IDs gets the ID column", async () => {
    const s = exportAs(["super_admin"], ok([row({ personalId: PERSONAL_ID })]));
    const res = await get("?includeIds=1");
    expect(s.rpcCalls()[0]!.args).toMatchObject({ p_include_ids: true });
    const [header, first] = await lines(res);
    expect(header).toBe(memberExportHeaders(true).map(csvEscape).join(","));
    expect(first!.split(",").at(-1)).toBe(PERSONAL_ID);
  });

  it("super_admin without the flag gets no ID column", async () => {
    const s = exportAs(["super_admin"], ok([row({ personalId: PERSONAL_ID })]));
    const res = await get("?includeIds=true");
    expect(s.rpcCalls()[0]!.args).toMatchObject({ p_include_ids: false });
    expect(await res.text()).not.toContain(PERSONAL_ID);
  });
});

describe("GET /admin/members/export — CSV formula injection", () => {
  it("neutralizes formula-leading member text and leaves phones intact", async () => {
    const hostile = row({
      firstName: '=HYPERLINK("http://evil.test","x")',
      lastName: "@SUM(A1)",
      delegateName: "-2+3",
      regionNameKa: "\t=1",
    });
    exportAs(["super_admin"], ok([hostile]));
    const [, first] = await lines(await get());
    expect(first).toContain(csvEscape(hostile.firstName));
    expect(csvEscape(hostile.firstName).startsWith(`"'=`)).toBe(true);
    expect(first).toContain(",'@SUM(A1),");
    expect(first).toContain(",'-2+3,");
    expect(first).toContain(",+995555123456,");
    // no cell (quoted or not) may start with a formula trigger
    expect(first).not.toMatch(/(^|,)"?[=@\t]/);
  });
});

describe("GET /admin/members/export — failures", () => {
  it("answers 500 without leaking the database's message, which stays in the server log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      exportAs(["finance"], { data: null, error: { message: "permission denied for relation x" } });
      const res = await get();
      expect(res.status).toBe(500);
      expect(await res.text()).not.toContain("permission denied");
      expect(log).toHaveBeenCalledWith(expect.stringContaining("permission denied for relation x"));
    } finally {
      log.mockRestore();
    }
  });
});
