import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cabinetStateFixture } from "@/lib/test-cabinet-state";

const server = vi.hoisted(() => ({ getCabinetState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => server);
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

import MembershipDonePage from "./page";

beforeEach(() => {
  vi.stubEnv("SHOW_MEMBERSHIP_DUES", undefined);
  server.getCabinetState.mockResolvedValue(cabinetStateFixture());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("membership done page while dues are hidden (the default, ADR-036)", () => {
  it("shows no payment code, transfer details or payment sentence", async () => {
    render(await MembershipDonePage());

    expect(screen.getByText("რეგისტრაცია დასრულებულია ✓")).toBeInTheDocument();
    expect(screen.queryByText("GR-APQ694")).toBeNull();
    expect(screen.queryByText(/₾|გადმორიცხ|შენატან|აქტიური/)).toBeNull();
    expect(screen.getByTestId("chosen-delegate")).toHaveTextContent("არ მყავს დელეგატი");
  });
});

describe("membership done page once dues are on (SHOW_MEMBERSHIP_DUES=true)", () => {
  it("shows the payment code again", async () => {
    vi.stubEnv("SHOW_MEMBERSHIP_DUES", "true");

    render(await MembershipDonePage());

    expect(screen.getAllByText("GR-APQ694").length).toBeGreaterThan(0);
    expect(screen.getByText(/გადმორიცხე/)).toBeInTheDocument();
  });
});
