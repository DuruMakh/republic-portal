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

// The layout passes its shipped HEADER_CTA_LABEL in; the component never owns that copy.
const JOIN = "შემოგვიერთდი";

describe("HeaderSessionAction", () => {
  it("is the one join door while signed out: შემოგვიერთდი to /join, with no separate შესვლა", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(<HeaderSessionAction joinLabel={JOIN} />);
    expect(await screen.findByRole("link", { name: JOIN })).toHaveAttribute("href", "/join");
    expect(screen.queryByRole("link", { name: "შესვლა" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("swaps to კაბინეტი when a session exists, replacing the join button rather than adding to it", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "x" } } } });
    render(<HeaderSessionAction joinLabel={JOIN} />);
    expect(await screen.findByRole("link", { name: "კაბინეტი" })).toHaveAttribute("href", "/me");
    expect(screen.queryByRole("link", { name: JOIN })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("keeps one visual weight across the swap, so the button does not change shape", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const guest = render(<HeaderSessionAction joinLabel={JOIN} />);
    const guestClasses = (await guest.findByRole("link", { name: JOIN })).className;
    guest.unmount();

    getSession.mockResolvedValue({ data: { session: { user: { id: "x" } } } });
    render(<HeaderSessionAction joinLabel={JOIN} />);
    const memberClasses = (await screen.findByRole("link", { name: "კაბინეტი" })).className;

    expect(memberClasses).toBe(guestClasses);
  });
});
