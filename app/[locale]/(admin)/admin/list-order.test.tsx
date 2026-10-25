import { describe, expect, it, vi } from "vitest";
import { fakeSession, ok } from "./_test-utils/fake-supabase";
const server = vi.hoisted(() => ({ createServerSupabase: vi.fn(), getAdminRoles: vi.fn() }));
vi.mock("@/lib/supabase/server", () => server);
vi.mock("./finances/actions", () => ({
  lookupMemberAction: vi.fn(),
  recordPaymentAction: vi.fn(),
  previewBulkAction: vi.fn(),
  confirmBulkAction: vi.fn(),
  voidPaymentAction: vi.fn(),
}));
vi.mock("./transfer/actions", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));
import AuditPage from "./audit/page";
import FinancesPage from "./finances/page";
import SupportPage from "./support/page";
import TransferPage from "./transfer/page";
describe("staff list ordering", () => {
  it.each([
    ["audit", AuditPage, "admin_audit"],
    ["finances", FinancesPage, "admin_payments"],
    ["support", SupportPage, "admin_support_messages"],
    ["transfer", TransferPage, "admin_members"],
  ])("%s orders tied dates by descending unique id before paging", async (_name, Page, table) => {
    server.getAdminRoles.mockResolvedValue(["super_admin"]);
    const session = fakeSession({
      from: (t) =>
        t === "admin_finance_stats" ? ok({ active_count: 0, mrr_gel: 0 }) : { ...ok([]), count: 0 },
    });
    server.createServerSupabase.mockResolvedValue(session.client);
    await Page({ searchParams: Promise.resolve({}) });
    const query = session.tableCalls().find((c) => c.name === table)!;
    expect(query.chain.filter((c) => c.method === "order")).toEqual([
      { method: "order", args: ["created_at", { ascending: false }] },
      { method: "order", args: ["id", { ascending: false }] },
    ]);
  });
});
