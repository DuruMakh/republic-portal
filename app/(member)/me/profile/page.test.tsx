import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_DELETE_BUTTON,
  ACCOUNT_DELETE_DELEGATE_NOTE,
  ACCOUNT_DELETE_HEADING,
  ACCOUNT_DELETE_STAFF_NOTE,
} from "@/lib/account-deletion-copy";
import { cabinetStateFixture } from "@/lib/test-cabinet-state";
import { fakeSession } from "../../../(admin)/admin/_test-utils/fake-supabase";

const server = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  getCabinetState: vi.fn(),
  getAdminRoles: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => server);
vi.mock("@/lib/supabase/public", () => ({ fetchPublicDelegates: async () => [] }));
vi.mock("./delete-account-actions", () => ({ deleteMyAccountAction: vi.fn() }));
// the two forms have their own tests (and ProfileForm builds a browser Supabase client)
vi.mock("./ProfileForm", () => ({ ProfileForm: () => null }));
vi.mock("./RegisteredProfileForm", () => ({ RegisteredProfileForm: () => null }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));

import ProfilePage from "./page";

const REGISTERED = cabinetStateFixture({
  standing: "registered",
  status: "registered",
  completed: false,
  tier: null,
  referenceCode: null,
  membershipExists: false,
  registrationCompletedAt: null,
});

beforeEach(() => {
  const { client } = fakeSession();
  server.createServerSupabase.mockResolvedValue({
    ...(client as object),
    auth: { getUser: async () => ({ data: { user: { phone: "995599123456" } } }) },
  });
  server.getCabinetState.mockResolvedValue(cabinetStateFixture());
  server.getAdminRoles.mockResolvedValue([]);
});

describe("profile page danger section (spec 2026-10-08 §3.1)", () => {
  it("closes the member page with the delete-account section", async () => {
    render(await ProfilePage());

    expect(screen.getByRole("heading", { name: ACCOUNT_DELETE_HEADING })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON })).toBeDisabled();
    expect(screen.queryByText(ACCOUNT_DELETE_STAFF_NOTE)).toBeNull();
    expect(screen.queryByText(ACCOUNT_DELETE_DELEGATE_NOTE)).toBeNull();
  });

  it("closes the registered (not yet a member) page with it too", async () => {
    server.getCabinetState.mockResolvedValue(REGISTERED);

    render(await ProfilePage());

    expect(screen.getByRole("heading", { name: ACCOUNT_DELETE_HEADING })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON })).toBeInTheDocument();
  });

  it.each([
    ["member", cabinetStateFixture()],
    ["registered", REGISTERED],
  ])("gives staff the explanation and no button on the %s page", async (_label, state) => {
    server.getCabinetState.mockResolvedValue(state);
    server.getAdminRoles.mockResolvedValue(["editor"]);

    render(await ProfilePage());

    expect(screen.getByText(ACCOUNT_DELETE_STAFF_NOTE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ACCOUNT_DELETE_BUTTON })).toBeNull();
  });

  it("tells an approved delegate their public page goes and their team moves", async () => {
    server.getCabinetState.mockResolvedValue(cabinetStateFixture({ delegateStatus: "approved" }));

    render(await ProfilePage());

    expect(screen.getByText(ACCOUNT_DELETE_DELEGATE_NOTE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON })).toBeInTheDocument();
  });

  it("does not call a pending delegate request a delegate", async () => {
    server.getCabinetState.mockResolvedValue(cabinetStateFixture({ delegateStatus: "pending" }));

    render(await ProfilePage());

    expect(screen.queryByText(ACCOUNT_DELETE_DELEGATE_NOTE)).toBeNull();
  });
});
