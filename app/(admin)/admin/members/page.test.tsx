import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_DELETE_BUTTON } from "@/lib/account-deletion-copy";
import type { AdminRole } from "@/lib/admin";
import { fakeSession, ok, type DbResult } from "../_test-utils/fake-supabase";

const server = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  getAdminRoles: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => server);
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));
// the actions import the server-only Supabase client; the page only passes them down
vi.mock("./actions", () => ({ revealPersonalIdAction: vi.fn() }));
vi.mock("./delete-member-actions", () => ({ deleteMemberAction: vi.fn() }));

import AdminMembersPage from "./page";

const MEMBER = {
  id: "11111111-1111-4111-8111-111111111111",
  first_name: "Nino",
  last_name: "Beridze",
  phone: "+995555123456",
  region_id: 1,
  region_name_ka: null,
  city_name_ka: null,
  delegate_id: null,
  delegate_first_name: null,
  delegate_last_name: null,
  status: "profile_completed",
  membership_tier: 10,
  reference_code: "GR-ABC123",
  created_at: "2026-08-01T00:00:00Z",
  registration_completed_at: "2026-08-02T00:00:00Z",
  is_delegate: false,
  standing: "member",
  signup_delegate_first_name: null,
  signup_delegate_last_name: null,
  city_id: null,
};

function rows(table: string): DbResult {
  return ok(table === "admin_members" ? [MEMBER] : []);
}

async function renderPage(roles: AdminRole[]) {
  server.getAdminRoles.mockResolvedValue(roles);
  const { client } = fakeSession({ from: rows });
  server.createServerSupabase.mockResolvedValue(client);
  render(await AdminMembersPage({ searchParams: Promise.resolve({}) }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("members list — the delete column (spec 2026-10-08 §3.4)", () => {
  it("gives a super_admin a delete column with one button per member row", async () => {
    await renderPage(["super_admin"]);

    expect(screen.getByRole("columnheader", { name: ADMIN_DELETE_BUTTON })).toBeInTheDocument();
    const row = screen.getByText(/Nino/).closest("tr");
    expect(row).not.toBeNull();
    expect(within(row!).getByRole("button", { name: ADMIN_DELETE_BUTTON })).toBeInTheDocument();
  });

  it.each([["verifier"], ["finance"]] as const)(
    "shows no delete column or button to a %s",
    async (role) => {
      await renderPage([role]);

      expect(screen.getByText(/Nino/)).toBeInTheDocument();
      expect(screen.queryByRole("columnheader", { name: ADMIN_DELETE_BUTTON })).toBeNull();
      expect(screen.queryByRole("button", { name: ADMIN_DELETE_BUTTON })).toBeNull();
    },
  );
});
