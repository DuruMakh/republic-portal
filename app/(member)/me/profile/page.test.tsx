import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const publicData = vi.hoisted(() => ({ delegates: [] as unknown[] }));
vi.mock("@/lib/supabase/public", () => ({
  fetchPublicDelegates: async () => publicData.delegates,
}));
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
  vi.stubEnv("SHOW_RATINGS", undefined);
  publicData.delegates = [];
  const { client } = fakeSession();
  server.createServerSupabase.mockResolvedValue({
    ...(client as object),
    auth: { getUser: async () => ({ data: { user: { phone: "995599123456" } } }) },
  });
  server.getCabinetState.mockResolvedValue(cabinetStateFixture());
  // staff standing comes from cabinet_state's own admin flag; a second admin_roles read would
  // only add a failure path (this one would take the page down)
  server.getAdminRoles.mockRejectedValue(new Error("admin_roles read failed"));
});

afterEach(() => {
  vi.unstubAllEnvs();
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
    server.getCabinetState.mockResolvedValue({ ...state, admin: true });

    render(await ProfilePage());

    expect(screen.getByText(ACCOUNT_DELETE_STAFF_NOTE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ACCOUNT_DELETE_BUTTON })).toBeNull();
  });

  it("never reads admin_roles itself", async () => {
    render(await ProfilePage());

    expect(server.getAdminRoles).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON })).toBeInTheDocument();
  });

  it("tells an approved delegate their public page goes and their team moves", async () => {
    server.getCabinetState.mockResolvedValue(
      cabinetStateFixture({ role: "delegate", delegateStatus: "approved" }),
    );

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

describe("profile page: my delegate card (ADR-052)", () => {
  const DELEGATE_ID = "00000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    publicData.delegates = [
      {
        id: DELEGATE_ID,
        slug: "eka-meladze",
        first_name: "ეკა",
        last_name: "მელაძე",
        region_id: 8,
        region_name_ka: "გურია",
        bio: null,
        photo_url: null,
        active_supporters: 3,
        members: 84,
      },
    ];
    server.getCabinetState.mockResolvedValue(
      cabinetStateFixture({
        chosenDelegate: { id: DELEGATE_ID, firstName: "ეკა", lastName: "მელაძე" },
      }),
    );
  });

  it("links the delegate with no rank or member count while ratings are hidden", async () => {
    render(await ProfilePage());

    expect(screen.getByRole("link", { name: "ეკა მელაძე" })).toHaveAttribute(
      "href",
      "/delegates/eka-meladze",
    );
    expect(screen.queryByTestId("rank-1")).toBeNull();
    expect(screen.queryByText("84")).toBeNull();
  });

  it("brings the rank and member count back once SHOW_RATINGS=true", async () => {
    vi.stubEnv("SHOW_RATINGS", "true");

    render(await ProfilePage());

    expect(screen.getByTestId("rank-1")).toBeInTheDocument();
    expect(screen.getByText("84")).toBeInTheDocument();
  });
});
