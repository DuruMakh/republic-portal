import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

import PublicLayout from "./layout";

const FINANCES = "ფინანსები";
const JOIN = "შემოგვიერთდი";
const SIGN_IN = "შესვლა";
const MENU = "მენიუ";

function renderLayout() {
  render(
    <PublicLayout>
      <p>page body</p>
    </PublicLayout>,
  );
}

beforeEach(() => {
  // Hidden is the default: pin it, so a SHOW_PUBLIC_FINANCES exported in the caller's shell cannot
  // flip these tests. The public-mode tests below stub it to "true" themselves.
  vi.stubEnv("SHOW_PUBLIC_FINANCES", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public layout — finances hidden (the default)", () => {
  it("lists no ფინანსები link in the header or the footer, and links nowhere to /transparency", () => {
    renderLayout();
    expect(
      within(screen.getByRole("banner")).queryByRole("link", { name: FINANCES }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("contentinfo")).queryByRole("link", { name: FINANCES }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/transparency"]')).toBeNull();
  });

  it("gives the header one account action — შემოგვიერთდი — and no separate შესვლა", () => {
    renderLayout();
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: JOIN })).toHaveAttribute("href", "/join");
    expect(within(header).queryByRole("link", { name: SIGN_IN })).not.toBeInTheDocument();
    expect(header.querySelector('a[href="/login"]')).toBeNull();
  });

  it("keeps the phone menu to the same one account action, with no შესვლა and no ფინანსები", () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: MENU }));
    const menu = screen.getByRole("dialog");
    expect(within(menu).getByRole("link", { name: JOIN })).toHaveAttribute("href", "/join");
    expect(within(menu).queryByRole("link", { name: SIGN_IN })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("link", { name: FINANCES })).not.toBeInTheDocument();
  });
});

describe("public layout — finances public (SHOW_PUBLIC_FINANCES=true)", () => {
  it("restores the ფინანსები link in the header and the footer", () => {
    vi.stubEnv("SHOW_PUBLIC_FINANCES", "true");
    renderLayout();
    expect(
      within(screen.getByRole("banner")).getByRole("link", { name: FINANCES }),
    ).toHaveAttribute("href", "/transparency");
    expect(
      within(screen.getByRole("contentinfo")).getByRole("link", { name: FINANCES }),
    ).toHaveAttribute("href", "/transparency");
  });
});
