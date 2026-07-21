import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CabinetState } from "@/lib/funnel";
import { MembershipWizard } from "./MembershipWizard";

const saveMembershipProfileAction = vi.fn();
const completeMembershipAction = vi.fn();
vi.mock("./actions", () => ({
  saveMembershipProfileAction: (input: unknown) => saveMembershipProfileAction(input),
  completeMembershipAction: (input: unknown) => completeMembershipAction(input),
}));
const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const REGIONS = [
  { id: 1, name_ka: "თბილისი" },
  { id: 2, name_ka: "იმერეთი" },
];
const CITIES_BY_REGION: Record<number, { id: number; name_ka: string }[]> = {
  1: [{ id: 5, name_ka: "თბილისი" }],
  2: [{ id: 9, name_ka: "ქუთაისი" }],
};
const DELEGATES_BY_REGION: Record<
  number,
  { id: string; first_name: string; last_name: string; region_name_ka: string }[]
> = {
  1: [{ id: "d1", first_name: "გია", last_name: "გიგოშვილი", region_name_ka: "თბილისი" }],
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "regions") {
        return { select: () => ({ order: () => Promise.resolve({ data: REGIONS }) }) };
      }
      if (table === "cities") {
        return {
          select: () => ({
            eq: (_column: string, regionId: number) => ({
              order: () => Promise.resolve({ data: CITIES_BY_REGION[regionId] ?? [] }),
            }),
          }),
        };
      }
      // public_delegates
      return {
        select: () => ({
          eq: (_column: string, regionId: number) => ({
            order: () => Promise.resolve({ data: DELEGATES_BY_REGION[regionId] ?? [] }),
          }),
        }),
      };
    },
  }),
}));

function cab(overrides: Partial<CabinetState> = {}): CabinetState {
  return {
    exists: true,
    standing: "registered",
    status: "registered",
    role: "member",
    firstName: "ნინო",
    lastName: "ბერიძე",
    personalIdMasked: "010********",
    birthDate: null,
    regionId: null,
    cityId: null,
    employment: null,
    tier: null,
    referenceCode: null,
    completed: false,
    delegateStatus: null,
    referral: null,
    pendingDelegate: null,
    chosenDelegate: null,
    membershipExists: false,
    registrationCompletedAt: null,
    createdAt: "2026-07-21T10:00:00Z",
    admin: false,
    ...overrides,
  };
}

// A profile that already satisfies deriveMembershipPhase's "tier" condition.
const PROFILED = {
  birthDate: "1990-05-20",
  regionId: 1,
  cityId: 5,
  employment: "სტუდენტი",
} as const;

beforeEach(() => {
  saveMembershipProfileAction.mockReset();
  completeMembershipAction.mockReset();
  pushMock.mockReset();
});

describe("MembershipWizard — phase derivation", () => {
  it("starts on the profile phase when wizard fields are incomplete", async () => {
    render(<MembershipWizard initialState={cab({})} />);
    expect(screen.getByText("იურიდიული პროფილი")).toBeInTheDocument();
    expect(screen.queryByText("საწევრო შენატანი")).toBeNull();
    await waitFor(() => expect(screen.getByLabelText("მხარე")).toBeInTheDocument());
  });

  it("starts on the tier phase directly when the profile is already saved", async () => {
    render(<MembershipWizard initialState={cab(PROFILED)} />);
    expect(screen.getByText("საწევრო შენატანი")).toBeInTheDocument();
    expect(screen.queryByText("იურიდიული პროფილი")).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "რეგისტრაციის დასრულება" })).toBeInTheDocument(),
    );
  });
});

describe("MembershipWizard — profile phase", () => {
  it("shows Georgian validation errors and does not call the action when required fields are empty", async () => {
    render(<MembershipWizard initialState={cab({})} />);
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება →" }));
    expect(await screen.findByText("მიუთითე საქმიანობა.")).toBeInTheDocument();
    expect(screen.getByText("აირჩიე მხარე.")).toBeInTheDocument();
    expect(screen.getByText("აირჩიე ქალაქი.")).toBeInTheDocument();
    expect(saveMembershipProfileAction).not.toHaveBeenCalled();
  });

  it("saves the profile and advances to the tier phase on success", async () => {
    saveMembershipProfileAction.mockResolvedValue({ ok: true, state: cab(PROFILED) });
    render(
      <MembershipWizard initialState={cab({ regionId: 1, cityId: 5, employment: "სტუდენტი" })} />,
    );
    fireEvent.change(screen.getByLabelText("დაბადების თარიღი"), {
      target: { value: "1990-05-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება →" }));
    await waitFor(() => expect(saveMembershipProfileAction).toHaveBeenCalled());
    expect(saveMembershipProfileAction.mock.calls[0]?.[0]).toMatchObject({
      birthDate: "1990-05-20",
      regionId: 1,
      cityId: 5,
      employment: "სტუდენტი",
      delegateId: null,
    });
    expect(await screen.findByText("საწევრო შენატანი")).toBeInTheDocument();
  });

  it("shows the Georgian error message when the save action fails", async () => {
    saveMembershipProfileAction.mockResolvedValue({
      ok: false,
      error: "სესია ამოიწურა — დაადასტურე ნომერი თავიდან.",
    });
    render(
      <MembershipWizard initialState={cab({ regionId: 1, cityId: 5, employment: "სტუდენტი" })} />,
    );
    fireEvent.change(screen.getByLabelText("დაბადების თარიღი"), {
      target: { value: "1990-05-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება →" }));
    expect(
      await screen.findByText("სესია ამოიწურა — დაადასტურე ნომერი თავიდან."),
    ).toBeInTheDocument();
    expect(screen.getByText("იურიდიული პროფილი")).toBeInTheDocument();
  });
});

describe("MembershipWizard — tier phase", () => {
  it("navigates to the done screen on successful completion", async () => {
    completeMembershipAction.mockResolvedValue({
      ok: true,
      state: cab({
        ...PROFILED,
        standing: "member",
        completed: true,
        tier: 10,
        referenceCode: "GR-APQ694",
        chosenDelegate: { id: "d1", firstName: "გია", lastName: "გიგოშვილი" },
      }),
    });
    render(<MembershipWizard initialState={cab(PROFILED)} />);
    fireEvent.click(screen.getByRole("button", { name: "რეგისტრაციის დასრულება" }));
    await waitFor(() => expect(completeMembershipAction).toHaveBeenCalledWith({ tier: 10 }));
    // the done screen (GR- code, bank instructions, chosen delegate) now lives at its
    // own route — /me/membership/done — rendered server-side, not in this component
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/me/membership/done"));
  });

  it("shows the Georgian error message when completion fails", async () => {
    completeMembershipAction.mockResolvedValue({
      ok: false,
      error: "აირჩიე საწევრო პაკეტი.",
    });
    render(<MembershipWizard initialState={cab(PROFILED)} />);
    fireEvent.click(screen.getByRole("button", { name: "რეგისტრაციის დასრულება" }));
    expect(await screen.findByText("აირჩიე საწევრო პაკეტი.")).toBeInTheDocument();
    expect(screen.getByText("საწევრო შენატანი")).toBeInTheDocument();
  });

  it("returns to the profile phase with fields intact via the back button", async () => {
    render(<MembershipWizard initialState={cab(PROFILED)} />);
    expect(screen.getByText("საწევრო შენატანი")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← პროფილის შესწორება" }));
    expect(screen.getByText("იურიდიული პროფილი")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("დაბადების თარიღი")).toHaveValue(PROFILED.birthDate),
    );
    expect(completeMembershipAction).not.toHaveBeenCalled();
  });

  it("clears a stale completion error when re-entering the tier phase via a fresh profile save", async () => {
    completeMembershipAction.mockResolvedValue({ ok: false, error: "აირჩიე საწევრო პაკეტი." });
    saveMembershipProfileAction.mockResolvedValue({ ok: true, state: cab(PROFILED) });
    render(<MembershipWizard initialState={cab(PROFILED)} />);
    fireEvent.click(screen.getByRole("button", { name: "რეგისტრაციის დასრულება" }));
    expect(await screen.findByText("აირჩიე საწევრო პაკეტი.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← პროფილის შესწორება" }));
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება →" }));
    await waitFor(() => expect(saveMembershipProfileAction).toHaveBeenCalled());
    expect(await screen.findByText("საწევრო შენატანი")).toBeInTheDocument();
    expect(screen.queryByText("აირჩიე საწევრო პაკეტი.")).toBeNull();
  });
});
