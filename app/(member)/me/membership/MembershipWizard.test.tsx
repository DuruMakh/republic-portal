import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DUPLICATE_PERSONAL_ID_MESSAGE,
  GENERIC_FUNNEL_ERROR,
  type CabinetStatePresent,
} from "@/lib/funnel";
import { cabinetStateFixture } from "@/lib/test-cabinet-state";
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

// A registered supporter who has not started the membership form yet.
function cab(overrides: Partial<CabinetStatePresent> = {}): CabinetStatePresent {
  return cabinetStateFixture({
    standing: "registered",
    status: "registered",
    completed: false,
    membershipExists: false,
    regionId: null,
    tier: null,
    referenceCode: null,
    registrationCompletedAt: null,
    ...overrides,
  });
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

const DATA_CONSENT = "თანახმა ვარ, ჩემი პირადი მონაცემები დამუშავდეს წევრობის გასაფორმებლად";
const DUES_CONSENT =
  "თანახმა ვარ, მომავალში, როცა საწევრო შემოიღება, ვიხდიდე ყოველთვიურ საწევროს — 10 ₾ თვეში";
const CONSENT_ERROR = "გასაგზავნად მონიშნე ორივე თანხმობა.";

function agreeToBoth() {
  fireEvent.click(screen.getByRole("checkbox", { name: DATA_CONSENT }));
  fireEvent.click(screen.getByRole("checkbox", { name: DUES_CONSENT }));
}

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
    expect(await screen.findByText("წევრობის განაცხადი")).toBeInTheDocument();
  });

  it("shows a Georgian error and re-enables the button when the save action rejects", async () => {
    saveMembershipProfileAction.mockRejectedValue(new Error("network drop"));
    render(
      <MembershipWizard initialState={cab({ regionId: 1, cityId: 5, employment: "სტუდენტი" })} />,
    );
    fireEvent.change(screen.getByLabelText("დაბადების თარიღი"), {
      target: { value: "1990-05-20" },
    });
    const submitButton = screen.getByRole("button", { name: "გაგრძელება →" });
    fireEvent.click(submitButton);
    await waitFor(() => expect(saveMembershipProfileAction).toHaveBeenCalled());
    expect(await screen.findByText(GENERIC_FUNNEL_ERROR)).toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();
    expect(screen.getByText("წევრის მონაცემები")).toBeInTheDocument();
  });
});

describe("MembershipWizard — personal ID at membership (owner fix #10)", () => {
  it("submits the entered personal ID when the profile has none yet", async () => {
    saveMembershipProfileAction.mockResolvedValue({ ok: true, state: cab(PROFILED) });
    render(
      <MembershipWizard
        initialState={cab({ hasPersonalId: false, regionId: 1, cityId: 5, employment: "სტუდენტი" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("პირადი ნომერი"), { target: { value: "01001000000" } });
    fireEvent.change(screen.getByLabelText("დაბადების თარიღი"), {
      target: { value: "1990-05-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება →" }));
    await waitFor(() => expect(saveMembershipProfileAction).toHaveBeenCalled());
    expect(saveMembershipProfileAction.mock.calls[0]?.[0]).toMatchObject({
      personalId: "01001000000",
    });
  });

  it("keeps every digit of a separator-formatted personal-ID paste now that the field has no maxlength to truncate it before submitProfile()'s normalisation runs", async () => {
    saveMembershipProfileAction.mockResolvedValue({ ok: true, state: cab(PROFILED) });
    render(
      <MembershipWizard
        initialState={cab({ hasPersonalId: false, regionId: 1, cityId: 5, employment: "სტუდენტი" })}
      />,
    );
    const idInput = screen.getByLabelText("პირადი ნომერი") as HTMLInputElement;
    // A real browser caps inserted/pasted text at the input's maxlength attribute
    // before the change event ever fires; fireEvent.change's direct .value
    // assignment does not, so the cap is reproduced explicitly here to prove the
    // paste normalisation in submitProfile() recovers every digit end-to-end.
    const pastedWithSeparators = "010 01 000000"; // same 11 digits, grouped with spaces
    const effectivePaste =
      idInput.maxLength >= 0
        ? pastedWithSeparators.slice(0, idInput.maxLength)
        : pastedWithSeparators;
    fireEvent.change(idInput, { target: { value: effectivePaste } });
    fireEvent.change(screen.getByLabelText("დაბადების თარიღი"), {
      target: { value: "1990-05-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება →" }));
    await waitFor(() => expect(saveMembershipProfileAction).toHaveBeenCalled());
    expect(saveMembershipProfileAction.mock.calls[0]?.[0]).toMatchObject({
      personalId: "01001000000",
    });
  });

  it("hides the ID field when the profile already has one and submits personalId: null", async () => {
    saveMembershipProfileAction.mockResolvedValue({ ok: true, state: cab(PROFILED) });
    render(
      <MembershipWizard
        initialState={cab({ hasPersonalId: true, regionId: 1, cityId: 5, employment: "სტუდენტი" })}
      />,
    );
    expect(screen.queryByLabelText("პირადი ნომერი")).toBeNull();
    fireEvent.change(screen.getByLabelText("დაბადების თარიღი"), {
      target: { value: "1990-05-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება →" }));
    await waitFor(() => expect(saveMembershipProfileAction).toHaveBeenCalled());
    expect(saveMembershipProfileAction.mock.calls[0]?.[0]).toMatchObject({ personalId: null });
  });

  it("maps a duplicate_personal_id failure onto the field, not the form banner", async () => {
    saveMembershipProfileAction.mockResolvedValue({
      ok: false,
      error: DUPLICATE_PERSONAL_ID_MESSAGE,
    });
    render(
      <MembershipWizard
        initialState={cab({ hasPersonalId: false, regionId: 1, cityId: 5, employment: "სტუდენტი" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("პირადი ნომერი"), { target: { value: "01001000000" } });
    fireEvent.change(screen.getByLabelText("დაბადების თარიღი"), {
      target: { value: "1990-05-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება →" }));
    expect(await screen.findByText(DUPLICATE_PERSONAL_ID_MESSAGE)).toBeInTheDocument();
    // still the profile phase — no separate form-level banner duplicating the same message
    expect(screen.getByText("წევრის მონაცემები")).toBeInTheDocument();
    // field-level, not just a banner that happens to say the same words (review finding M2):
    // Field only sets aria-invalid when its own `error` prop is populated
    expect(screen.getByLabelText("პირადი ნომერი")).toHaveAttribute("aria-invalid", "true");
  });

  it("stops asking for the ID after a successful save, even after navigating back to the profile phase (review finding F2)", async () => {
    // askPersonalId used to be a one-time snapshot of initialState.hasPersonalId — a
    // save that captures the ID server-side never refreshed it, so "← პროფილის
    // შესწორება" re-rendered the now-stale editable field. Resubmitting it sent a
    // value the server's immutable-once-set coalesce silently discarded.
    saveMembershipProfileAction.mockResolvedValue({
      ok: true,
      state: cab({ ...PROFILED, hasPersonalId: true }),
    });
    render(
      <MembershipWizard
        initialState={cab({ hasPersonalId: false, regionId: 1, cityId: 5, employment: "სტუდენტი" })}
      />,
    );
    expect(screen.getByLabelText("პირადი ნომერი")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("პირადი ნომერი"), { target: { value: "01001000000" } });
    fireEvent.change(screen.getByLabelText("დაბადების თარიღი"), {
      target: { value: "1990-05-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება →" }));
    expect(await screen.findByText("წევრობის განაცხადი")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "← მონაცემების შესწორება" }));
    expect(screen.getByText("წევრის მონაცემები")).toBeInTheDocument();
    expect(screen.queryByLabelText("პირადი ნომერი")).toBeNull();
  });
});

describe("MembershipWizard — tier phase", () => {
  it("refuses to send until both consents are ticked, without calling the server", async () => {
    render(<MembershipWizard initialState={cab(PROFILED)} />);
    const send = screen.getByRole("button", { name: "განაცხადის გაგზავნა" });
    fireEvent.click(send);
    expect(await screen.findByText(CONSENT_ERROR)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: DATA_CONSENT }));
    fireEvent.click(send);
    expect(screen.getByText(CONSENT_ERROR)).toBeInTheDocument();
    expect(completeMembershipAction).not.toHaveBeenCalled();
  });

  it("announces the consent prompt and retires it once a box is ticked", async () => {
    render(<MembershipWizard initialState={cab(PROFILED)} />);
    fireEvent.click(screen.getByRole("button", { name: "განაცხადის გაგზავნა" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(CONSENT_ERROR);
    fireEvent.click(screen.getByRole("checkbox", { name: DATA_CONSENT }));
    expect(screen.queryByText(CONSENT_ERROR)).toBeNull();
  });

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
    agreeToBoth();
    fireEvent.click(screen.getByRole("button", { name: "განაცხადის გაგზავნა" }));
    await waitFor(() => expect(completeMembershipAction).toHaveBeenCalledWith({ tier: 10 }));
    // the done screen (application sent, chosen delegate) now lives at its
    // own route — /me/membership/done — rendered server-side, not in this component
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/me/membership/done"));
  });

  it("shows the Georgian error message when completion fails", async () => {
    completeMembershipAction.mockResolvedValue({
      ok: false,
      error: "აირჩიე საწევრო პაკეტი.",
    });
    render(<MembershipWizard initialState={cab(PROFILED)} />);
    agreeToBoth();
    fireEvent.click(screen.getByRole("button", { name: "განაცხადის გაგზავნა" }));
    expect(await screen.findByText("აირჩიე საწევრო პაკეტი.")).toBeInTheDocument();
    expect(screen.getByText("წევრობის განაცხადი")).toBeInTheDocument();
  });

  it("shows a Georgian error, re-enables the button, and does not navigate when completion rejects", async () => {
    completeMembershipAction.mockRejectedValue(new Error("network drop"));
    render(<MembershipWizard initialState={cab(PROFILED)} />);
    agreeToBoth();
    const completeButton = screen.getByRole("button", { name: "განაცხადის გაგზავნა" });
    fireEvent.click(completeButton);
    await waitFor(() => expect(completeMembershipAction).toHaveBeenCalledWith({ tier: 10 }));
    expect(await screen.findByText(GENERIC_FUNNEL_ERROR)).toBeInTheDocument();
    expect(completeButton).not.toBeDisabled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("returns to the profile phase with fields intact via the back button", async () => {
    render(<MembershipWizard initialState={cab(PROFILED)} />);
    expect(screen.getByText("წევრობის განაცხადი")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← მონაცემების შესწორება" }));
    expect(screen.getByText("წევრის მონაცემები")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("დაბადების თარიღი")).toHaveValue(PROFILED.birthDate),
    );
    expect(completeMembershipAction).not.toHaveBeenCalled();
  });

  it("clears a stale completion error when re-entering the tier phase via a fresh profile save", async () => {
    completeMembershipAction.mockResolvedValue({ ok: false, error: "აირჩიე საწევრო პაკეტი." });
    saveMembershipProfileAction.mockResolvedValue({ ok: true, state: cab(PROFILED) });
    render(<MembershipWizard initialState={cab(PROFILED)} />);
    agreeToBoth();
    fireEvent.click(screen.getByRole("button", { name: "განაცხადის გაგზავნა" }));
    expect(await screen.findByText("აირჩიე საწევრო პაკეტი.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← მონაცემების შესწორება" }));
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება →" }));
    await waitFor(() => expect(saveMembershipProfileAction).toHaveBeenCalled());
    expect(await screen.findByText("წევრობის განაცხადი")).toBeInTheDocument();
    expect(screen.queryByText("აირჩიე საწევრო პაკეტი.")).toBeNull();
  });
});
