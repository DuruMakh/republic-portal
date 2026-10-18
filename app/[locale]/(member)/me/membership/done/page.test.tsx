import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cabinetStateFixture } from "@/lib/test-cabinet-state";

const redirectMock = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`);
});
vi.mock("next/navigation", () => ({ redirect: (path: string) => redirectMock(path) }));

const getCabinetStateMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ getCabinetState: () => getCabinetStateMock() }));

import MembershipDonePage from "./page";

const completed = cabinetStateFixture;

beforeEach(() => {
  redirectMock.mockClear();
  getCabinetStateMock.mockReset();
});

describe("membership done page (ADR-036)", () => {
  it("tells a fresh applicant the board will review the application, with no transfer instructions", async () => {
    getCabinetStateMock.mockResolvedValue(completed());
    render(await MembershipDonePage());
    expect(screen.getByRole("heading", { name: "განაცხადი გაგზავნილია ✓" })).toBeInTheDocument();
    expect(screen.getByText("განხილვის პროცესში")).toBeInTheDocument();
    expect(screen.getByText("შენს განაცხადს განიხილავს ბორდი.")).toBeInTheDocument();
    expect(screen.queryByTestId("reference-code")).toBeNull();
    expect(screen.queryByText("GR-APQ694")).toBeNull();
  });

  it("does not tell an already-active member their application is under review", async () => {
    getCabinetStateMock.mockResolvedValue(completed({ status: "active_member" }));
    render(await MembershipDonePage());
    expect(screen.queryByText("განხილვის პროცესში")).toBeNull();
    expect(screen.queryByText("შენს განაცხადს განიხილავს ბორდი.")).toBeNull();
    expect(screen.queryByRole("heading", { name: "განაცხადი გაგზავნილია ✓" })).toBeNull();
    // the active_member pill reads plainly „წევრი“ since ADR-037 (no active tier)
    expect(screen.getByText("წევრი")).toBeInTheDocument();
  });
});
