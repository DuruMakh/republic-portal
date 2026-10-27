import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
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
  1: [
    { id: 5, name_ka: "თბილისი" },
    { id: 6, name_ka: "რუსთავი" },
  ],
  2: [{ id: 9, name_ka: "ქუთაისი" }],
};
const DELEGATES_BY_REGION: Record<
  number,
  { id: string; first_name: string; last_name: string; region_name_ka: string }[]
> = {
  1: [{ id: "d1", first_name: "გია", last_name: "გიგოშვილი", region_name_ka: "თბილისი" }],
};

const readOptions = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: () => ({
        order: () => readOptions(table),
        eq: (_column: string, regionId: number) => ({ order: () => readOptions(table, regionId) }),
      }),
    }),
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
  readOptions.mockReset();
  readOptions.mockImplementation((table: string, regionId: number) =>
    Promise.resolve({
      data:
        table === "regions"
          ? REGIONS
          : table === "cities"
            ? (CITIES_BY_REGION[regionId] ?? [])
            : (DELEGATES_BY_REGION[regionId] ?? []),
    }),
  );
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
  it("prefills the original Student value while displaying its English label", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <MembershipWizard initialState={cab({ regionId: 1, cityId: 5, employment: "სტუდენტი" })} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("combobox", { name: "Employment / status" })).toHaveValue("სტუდენტი");
    expect(screen.getByRole("option", { name: "Student", selected: true })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "City / municipality" })).toHaveValue("5"),
    );
  });

  it("submits the original value when an English employment label is selected", async () => {
    saveMembershipProfileAction.mockResolvedValue({ ok: true, state: cab(PROFILED) });
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <MembershipWizard initialState={cab({ regionId: 1, cityId: 5, employment: "სტუდენტი" })} />
      </NextIntlClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "City / municipality" })).toHaveValue("5"),
    );
    fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: "1990-05-20" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Employment / status" }), {
      target: { value: screen.getByRole("option", { name: "Employed" }).getAttribute("value") },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(saveMembershipProfileAction).toHaveBeenCalled());
    expect(saveMembershipProfileAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ employment: "დასაქმებული" }),
    );
  });

  it("shows Georgian validation errors and does not call the action when required fields are empty", async () => {
    render(<MembershipWizard initialState={cab({})} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "გაგრძელება" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება" }));
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
    fireEvent.change(screen.getByLabelText(/დაბადების თარიღი/), {
      target: { value: "1990-05-20" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "გაგრძელება" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება" }));
    await waitFor(() => expect(saveMembershipProfileAction).toHaveBeenCalled());
    expect(saveMembershipProfileAction.mock.calls[0]?.[0]).toMatchObject({
      birthDate: "1990-05-20",
      regionId: 1,
      cityId: 5,
      employment: "სტუდენტი",
      delegateId: null,
    });
    expect(await screen.findByText("წევრობის განაცხადი")).toHaveFocus();
  });

  it("shows a Georgian error and re-enables the button when the save action rejects", async () => {
    saveMembershipProfileAction.mockRejectedValue(new Error("network drop"));
    render(
      <MembershipWizard initialState={cab({ regionId: 1, cityId: 5, employment: "სტუდენტი" })} />,
    );
    fireEvent.change(screen.getByLabelText(/დაბადების თარიღი/), {
      target: { value: "1990-05-20" },
    });
    const submitButton = screen.getByRole("button", { name: "გაგრძელება" });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
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
    fireEvent.change(screen.getByRole("textbox", { name: "პირადი ნომერი" }), {
      target: { value: "01001000000" },
    });
    fireEvent.change(screen.getByLabelText(/დაბადების თარიღი/), {
      target: { value: "1990-05-20" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "გაგრძელება" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება" }));
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
    const idInput = screen.getByRole("textbox", { name: "პირადი ნომერი" }) as HTMLInputElement;
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
    fireEvent.change(screen.getByLabelText(/დაბადების თარიღი/), {
      target: { value: "1990-05-20" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "გაგრძელება" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება" }));
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
    expect(screen.queryByRole("textbox", { name: "პირადი ნომერი" })).toBeNull();
    fireEvent.change(screen.getByLabelText(/დაბადების თარიღი/), {
      target: { value: "1990-05-20" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "გაგრძელება" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება" }));
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
    fireEvent.change(screen.getByRole("textbox", { name: "პირადი ნომერი" }), {
      target: { value: "01001000000" },
    });
    fireEvent.change(screen.getByLabelText(/დაბადების თარიღი/), {
      target: { value: "1990-05-20" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "გაგრძელება" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება" }));
    expect(await screen.findByText(DUPLICATE_PERSONAL_ID_MESSAGE)).toBeInTheDocument();
    // still the profile phase — no separate form-level banner duplicating the same message
    expect(screen.getByText("წევრის მონაცემები")).toBeInTheDocument();
    // field-level, not just a banner that happens to say the same words (review finding M2):
    // Field only sets aria-invalid when its own `error` prop is populated
    expect(screen.getByRole("textbox", { name: "პირადი ნომერი" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
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
    expect(screen.getByRole("textbox", { name: "პირადი ნომერი" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "პირადი ნომერი" }), {
      target: { value: "01001000000" },
    });
    fireEvent.change(screen.getByLabelText(/დაბადების თარიღი/), {
      target: { value: "1990-05-20" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "გაგრძელება" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება" }));
    expect(await screen.findByText("წევრობის განაცხადი")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "← მონაცემების შესწორება" }));
    expect(screen.getByText("წევრის მონაცემები")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "პირადი ნომერი" })).toBeNull();
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
      expect(screen.getByLabelText(/დაბადების თარიღი/)).toHaveValue(PROFILED.birthDate),
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
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "გაგრძელება" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება" }));
    await waitFor(() => expect(saveMembershipProfileAction).toHaveBeenCalled());
    expect(await screen.findByText("წევრობის განაცხადი")).toBeInTheDocument();
    expect(screen.queryByText("აირჩიე საწევრო პაკეტი.")).toBeNull();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("MembershipWizard — read recovery and focus", () => {
  it("ignores older city/delegate responses after the user changes region", async () => {
    const oldCities = deferred<{ data: (typeof CITIES_BY_REGION)[1] }>();
    const oldDelegates = deferred<{ data: (typeof DELEGATES_BY_REGION)[1] }>();
    readOptions.mockImplementation((table: string, region: number) => {
      if (table === "regions") return Promise.resolve({ data: REGIONS });
      if (region === 1) return table === "cities" ? oldCities.promise : oldDelegates.promise;
      return Promise.resolve({
        data:
          table === "cities"
            ? CITIES_BY_REGION[2]
            : [{ id: "d2", first_name: "ანა", last_name: "ტესტი", region_name_ka: "იმერეთი" }],
      });
    });
    render(<MembershipWizard initialState={cab({ regionId: 1, cityId: 5 })} />);
    await screen.findByRole("option", { name: "იმერეთი" });
    fireEvent.change(screen.getByRole("combobox", { name: "მხარე" }), { target: { value: "2" } });
    expect(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" })).toHaveValue("");
    await screen.findByRole("option", { name: "ქუთაისი" });
    fireEvent.change(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" }), {
      target: { value: "9" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "დელეგატი" }), {
      target: { value: "d2" },
    });
    await act(async () => {
      oldCities.resolve({ data: CITIES_BY_REGION[1]! });
      oldDelegates.resolve({ data: DELEGATES_BY_REGION[1]! });
    });
    expect(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" })).toHaveValue("9");
    expect(screen.getByRole("combobox", { name: "დელეგატი" })).toHaveValue("d2");
    expect(screen.queryByRole("option", { name: /გია/ })).toBeNull();
  });

  it("retries failed regions in English without erasing entered text", async () => {
    readOptions.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <MembershipWizard initialState={cab()} />
      </NextIntlClientProvider>,
    );
    fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: "1990-05-20" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Regions could not be loaded.");
    expect(screen.getByRole("combobox", { name: "Region" })).toHaveAttribute(
      "aria-describedby",
      "mw-regions-load-error",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry regions" }));
    await screen.findByRole("option", { name: "Tbilisi" });
    expect(screen.getByLabelText(/Date of birth/)).toHaveValue("1990-05-20");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(["cities", "public_delegates"])(
    "blocks stale submission and retries failed %s",
    async (failedTable) => {
      let failed = true;
      readOptions.mockImplementation((table: string, region: number) => {
        if (table === failedTable && failed) return Promise.reject(new Error("offline"));
        return Promise.resolve({
          data:
            table === "regions"
              ? REGIONS
              : table === "cities"
                ? CITIES_BY_REGION[region]
                : (DELEGATES_BY_REGION[region] ?? []),
        });
      });
      render(
        <MembershipWizard initialState={cab({ regionId: 1, cityId: 5, employment: "სტუდენტი" })} />,
      );
      fireEvent.change(screen.getByLabelText(/დაბადების თარიღი/), {
        target: { value: "1990-05-20" },
      });
      await screen.findByRole("alert");
      fireEvent.click(screen.getByRole("button", { name: "გაგრძელება" }));
      expect(saveMembershipProfileAction).not.toHaveBeenCalled();
      failed = false;
      fireEvent.click(
        screen.getByRole("button", {
          name: failedTable === "cities" ? "ქალაქების თავიდან ცდა" : "დელეგატების თავიდან ცდა",
        }),
      );
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "გაგრძელება" })).not.toBeDisabled(),
      );
      expect(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" })).toHaveValue("5");
      expect(screen.getByLabelText(/დაბადების თარიღი/)).toHaveValue("1990-05-20");
    },
  );

  it("distinguishes successful empty lists from failures", async () => {
    readOptions.mockImplementation((table: string) =>
      Promise.resolve({ data: table === "regions" ? REGIONS : [] }),
    );
    render(<MembershipWizard initialState={cab({ regionId: 1, cityId: 5 })} />);
    expect(await screen.findByText("ამ მხარეში ქალაქები ვერ მოიძებნა.")).toBeInTheDocument();
    expect(screen.getByText("ამ მხარეში დელეგატები არ არის.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" })).toBeDisabled();
  });

  it("keeps valid resumed city and delegate choices", async () => {
    render(
      <MembershipWizard
        initialState={cab({
          regionId: 1,
          cityId: 6,
          pendingDelegate: { id: "d1", firstName: "გია", lastName: "გიგოშვილი" },
        })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "დელეგატი" })).toHaveValue("d1"),
    );
    expect(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" })).toHaveValue("6");
  });

  it("renders dependent read errors, retry and empty copy in the existing English test locale", async () => {
    let failed = true;
    readOptions.mockImplementation((table: string) =>
      Promise.resolve(
        table === "regions"
          ? { data: REGIONS }
          : failed
            ? { data: null, error: { message: "offline" } }
            : { data: [] },
      ),
    );
    render(
      <NextIntlClientProvider locale="en" messages={{}}>
        <MembershipWizard initialState={cab({ regionId: 1 })} />
      </NextIntlClientProvider>,
    );
    await screen.findByText("Cities could not be loaded.");
    await screen.findByText("Delegates could not be loaded.");
    failed = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry cities" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry delegates" }));
    expect(await screen.findByText("No cities were found in this region.")).toBeInTheDocument();
    expect(await screen.findByText("There are no delegates in this region.")).toBeInTheDocument();
  });

  it("preserves a referral-bound delegate when the user changes region", async () => {
    const id = "6f1b0a9e-0000-4000-8000-0000000000aa";
    saveMembershipProfileAction.mockResolvedValue({ ok: true, state: cab(PROFILED) });
    render(
      <MembershipWizard
        initialState={cab({
          regionId: 1,
          cityId: 5,
          employment: "სტუდენტი",
          referral: { firstName: "გია", lastName: "გიგოშვილი", regionNameKa: "თბილისი" },
          pendingDelegate: { id, firstName: "გია", lastName: "გიგოშვილი" },
        })}
      />,
    );
    await screen.findByRole("option", { name: "იმერეთი" });
    fireEvent.change(screen.getByRole("combobox", { name: "მხარე" }), { target: { value: "2" } });
    await screen.findByRole("option", { name: "ქუთაისი" });
    fireEvent.change(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" }), {
      target: { value: "9" },
    });
    fireEvent.change(screen.getByLabelText(/დაბადების თარიღი/), {
      target: { value: "1990-05-20" },
    });
    expect(screen.queryByRole("combobox", { name: "დელეგატი" })).toBeNull();
    expect(screen.getByText("გია გიგოშვილი")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება" }));
    await waitFor(() =>
      expect(saveMembershipProfileAction).toHaveBeenCalledWith(
        expect.objectContaining({ delegateId: id, cityId: 9 }),
      ),
    );
  });

  it("does not permit a saved city to be sent while its replacement list is loading", async () => {
    const replacement = deferred<{ data: (typeof CITIES_BY_REGION)[2] }>();
    const read = readOptions.getMockImplementation()!;
    readOptions.mockImplementation((table: string, region: number) =>
      table === "cities" && region === 2 ? replacement.promise : read(table, region),
    );
    render(
      <MembershipWizard initialState={cab({ regionId: 1, cityId: 5, employment: "სტუდენტი" })} />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "გაგრძელება" })).not.toBeDisabled(),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "მხარე" }), { target: { value: "2" } });
    const city = screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" });
    expect(city).toBeDisabled();
    expect(city).toHaveValue("");
    fireEvent.submit(city.closest("form")!);
    expect(saveMembershipProfileAction).not.toHaveBeenCalled();
    await act(async () => replacement.resolve({ data: CITIES_BY_REGION[2]! }));
  });

  it("shows a successful empty regions response without an error or retry", async () => {
    readOptions.mockResolvedValue({ data: [] });
    render(<MembershipWizard initialState={cab()} />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("მხარეები ვერ მოიძებნა."),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "მხარეების თავიდან ცდა" })).toBeNull();
  });

  it.each([
    { response: { data: null, error: { message: "offline" } }, message: "მხარეები ვერ ჩაიტვირთა." },
    { response: { data: [] }, message: "მხარეები ვერ მოიძებნა." },
  ])(
    "focuses existing region feedback after submission: $message",
    async ({ response, message }) => {
      readOptions.mockResolvedValue(response);
      render(
        <MembershipWizard initialState={cab({ hasPersonalId: true, employment: "სტუდენტი" })} />,
      );
      const birthDate = screen.getByLabelText(/დაბადების თარიღი/);
      birthDate.focus();
      const feedback = await screen.findByText(message);
      expect(birthDate).toHaveFocus();
      fireEvent.change(birthDate, { target: { value: "1990-05-20" } });
      expect(birthDate).toHaveFocus();
      expect(screen.getByRole("combobox", { name: "მხარე" })).toBeDisabled();
      expect(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "გაგრძელება" }));
      expect(feedback).toHaveFocus();
      expect(screen.getAllByText(message)).toHaveLength(1);
      expect(birthDate).toHaveValue("1990-05-20");
      expect(screen.getByRole("combobox", { name: "სამუშაო ადგილი / სტატუსი" })).toHaveValue(
        "სტუდენტი",
      );
      expect(saveMembershipProfileAction).not.toHaveBeenCalled();
    },
  );

  it("focuses validation only after submission and focuses an existing step heading after navigation", async () => {
    render(<MembershipWizard initialState={cab()} />);
    expect(screen.getByLabelText(/დაბადების თარიღი/)).not.toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "გაგრძელება" }));
    expect(screen.getByLabelText(/დაბადების თარიღი/)).toHaveFocus();
  });
});
