import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELEGATE_LEFT_NOTE } from "@/lib/account-deletion-copy";
import { cabinetStateFixture } from "@/lib/test-cabinet-state";
import {
  fakeSession,
  ok,
  type FakeSession,
} from "../../../(admin)/admin/_test-utils/fake-supabase";

const server = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  getCabinetState: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => server);
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
// the picker has its own test (and needs the router)
vi.mock("./DelegateChange", () => ({ DelegateChange: () => null }));

import MyDelegatePage from "./page";

/** The page's reads: delegates and regions are empty, the open membership is what the test sets. */
function session(openMembership: { note: "delegate_left" | null } | null): FakeSession {
  const s = fakeSession({
    from: (table) => {
      if (table === "memberships") return ok(openMembership);
      if (table === "public_delegates" || table === "regions") return ok([]);
      return undefined;
    },
  });
  server.createServerSupabase.mockResolvedValue(s.client);
  return s;
}

beforeEach(() => {
  server.getCabinetState.mockResolvedValue(cabinetStateFixture());
});

describe("my-delegate page: the delegate-left note (spec 2026-10-08 §3.2)", () => {
  it("tells the member their delegate left, as a status message", async () => {
    session({ note: "delegate_left" });

    render(await MyDelegatePage());

    const note = screen.getByRole("status");
    expect(note).toHaveTextContent(DELEGATE_LEFT_NOTE);
  });

  it("shows nothing when the open membership carries no note", async () => {
    session({ note: null });

    render(await MyDelegatePage());

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(DELEGATE_LEFT_NOTE)).toBeNull();
  });

  it("shows nothing when there is no open membership row", async () => {
    session(null);

    render(await MyDelegatePage());

    expect(screen.queryByText(DELEGATE_LEFT_NOTE)).toBeNull();
  });

  it("reads only the caller's OPEN membership, through their own session", async () => {
    const s = session({ note: null });

    await MyDelegatePage();

    const read = s.tableCalls().find((c) => c.name === "memberships");
    expect(read?.chain).toEqual([
      { method: "select", args: ["note"] },
      { method: "is", args: ["ended_at", null] },
      { method: "maybeSingle", args: [] },
    ]);
  });
});
