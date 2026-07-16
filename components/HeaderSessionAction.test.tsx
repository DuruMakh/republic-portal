import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

import { HeaderSessionAction } from "./HeaderSessionAction";

describe("HeaderSessionAction", () => {
  it("shows შესვლა while signed out", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(<HeaderSessionAction />);
    expect(await screen.findByRole("link", { name: "შესვლა" })).toHaveAttribute("href", "/login");
  });
  it("swaps to კაბინეტი when a session exists", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "x" } } } });
    render(<HeaderSessionAction />);
    expect(await screen.findByRole("link", { name: "კაბინეტი" })).toHaveAttribute("href", "/me");
  });
});
