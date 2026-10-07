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

  it("keeps ფინანსები out of the phone menu", () => {
    renderLayout();
    fireEvent.click(screen.getByRole("button", { name: MENU }));
    expect(
      within(screen.getByRole("dialog")).queryByRole("link", { name: FINANCES }),
    ).not.toBeInTheDocument();
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
