import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { ProfileForm } from "./ProfileForm";

const updateProfileAction = vi.fn();
const readCities = vi.fn();
beforeEach(() => {
  updateProfileAction.mockReset();
  readCities.mockReset();
  readCities.mockImplementation((regionId: number) =>
    Promise.resolve({ data: CITIES_BY_REGION[regionId] ?? [] }),
  );
});
vi.mock("../actions", () => ({
  updateProfileAction: (input: unknown) => updateProfileAction(input),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
const CITIES_BY_REGION: Record<number, { id: number; name_ka: string }[]> = {
  1: [
    { id: 3, name_ka: "თბილისი" },
    { id: 4, name_ka: "რუსთავი" },
  ],
  2: [{ id: 9, name_ka: "ქუთაისი" }],
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_column: string, regionId: number) => ({
          order: () => readCities(regionId),
        }),
      }),
    }),
  }),
}));

const REGIONS = [
  { id: 1, name_ka: "თბილისი" },
  { id: 2, name_ka: "იმერეთი" },
];

function renderForm(employment: string, hasPersonalId = true, locale = "ka") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      <ProfileForm
        initial={{
          firstName: "ნინო",
          lastName: "ბერიძე",
          regionId: 1,
          cityId: 3,
          employment,
        }}
        phone="995599123456"
        regions={REGIONS}
        hasPersonalId={hasPersonalId}
      />
    </NextIntlClientProvider>,
  );
}

describe("ProfileForm", () => {
  it("prefills the original Student value while displaying its English label", async () => {
    renderForm("სტუდენტი", true, "en");
    expect(screen.getByRole("combobox", { name: "Employment / status" })).toHaveValue("სტუდენტი");
    expect(screen.getByRole("option", { name: "Student", selected: true })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "City / municipality" })).toHaveValue("3"),
    );
  });

  it("submits the original value when an English employment label is selected", async () => {
    updateProfileAction.mockResolvedValue({ ok: true, state: {} });
    renderForm("სტუდენტი", true, "en");
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "City / municipality" })).toHaveValue("3"),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Employment / status" }), {
      target: { value: screen.getByRole("option", { name: "Employed" }).getAttribute("value") },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateProfileAction).toHaveBeenCalled());
    expect(updateProfileAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ employment: "დასაქმებული" }),
    );
  });

  it("prefills preset employment; phone is formatted read-only; PID fully masked", async () => {
    renderForm("სტუდენტი");
    expect(screen.getByRole("textbox", { name: "სახელი" })).toHaveValue("ნინო");
    expect(screen.getByRole("combobox", { name: "სამუშაო ადგილი / სტატუსი" })).toHaveValue(
      "სტუდენტი",
    );
    expect(screen.getByTestId("profile-phone")).toHaveValue("+995 599 12 34 56");
    expect(screen.getByTestId("profile-phone")).toHaveAttribute("readonly");
    expect(screen.getByTestId("profile-pid")).toHaveValue("•••••••••••");
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" })).toHaveValue("3"),
    );
  });

  it("non-preset employment renders as „სხვა“ with the custom text", async () => {
    renderForm("მეწარმე");
    expect(screen.getByRole("combobox", { name: "სამუშაო ადგილი / სტატუსი" })).toHaveValue(
      "__other",
    );
    expect(screen.getByRole("textbox", { name: "მიუთითე საქმიანობა" })).toHaveValue("მეწარმე");
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" })).toHaveValue("3"),
    );
  });

  it("submits the mapped employment and confirms in Georgian", async () => {
    updateProfileAction.mockResolvedValue({ ok: true, state: {} });
    renderForm("სტუდენტი");
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" })).toHaveValue("3"),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "სამუშაო ადგილი / სტატუსი" }), {
      target: { value: "__other" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "მიუთითე საქმიანობა" }), {
      target: { value: "მეწარმე" },
    });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() => expect(updateProfileAction).toHaveBeenCalled());
    expect(updateProfileAction.mock.calls[0]?.[0]).toMatchObject({ employment: "მეწარმე" });
    expect(await screen.findByRole("status")).toHaveTextContent("პროფილი განახლდა ✓");
    fireEvent.change(screen.getByRole("textbox", { name: "სახელი" }), {
      target: { value: "გიორგი" },
    });
    expect(screen.queryByTestId("profile-saved")).toBeNull();
  });

  it("resets the city selection when the region changes and the current city is invalid there", async () => {
    renderForm("სტუდენტი");
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" })).toHaveValue("3"),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "მხარე" }), { target: { value: "2" } });
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" })).toHaveValue("9"),
    );
  });

  it("hides the PID row when the profile has no personal ID yet (owner fix #10)", async () => {
    renderForm("სტუდენტი", false);
    expect(screen.queryByTestId("profile-pid")).toBeNull();
    expect(screen.queryByRole("textbox", { name: "პირადი ნომერი" })).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" })).toHaveValue("3"),
    );
  });
});

it("announces a cities read error while retaining edited text", async () => {
  readCities.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
  renderForm("სტუდენტი");
  fireEvent.change(screen.getByRole("textbox", { name: "სახელი" }), { target: { value: "ანა" } });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "რაღაც შეცდომა მოხდა — სცადე თავიდან.",
  );
  expect(screen.getByRole("textbox", { name: "სახელი" })).toHaveValue("ანა");
  expect(screen.getByRole("button", { name: "შენახვა" })).toBeEnabled();
});

it("associates validation with the first invalid field and focuses it after submission", async () => {
  renderForm("სტუდენტი");
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" })).toHaveValue("3"),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "სახელი" }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
  expect(await screen.findByText("შეავსე ეს ველი")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "სახელი" })).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("textbox", { name: "სახელი" })).toHaveFocus();
});

it("keeps the prior city and save available during reads, ignoring a late response", async () => {
  let resolveOld!: (value: { data: { id: number; name_ka: string }[] }) => void;
  readCities.mockResolvedValueOnce({ data: CITIES_BY_REGION[1] }).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveOld = resolve;
    }),
  );
  renderForm("სტუდენტი");
  const city = screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" });
  await waitFor(() => expect(city).toHaveValue("3"));
  fireEvent.change(screen.getByRole("combobox", { name: "მხარე" }), { target: { value: "2" } });
  expect(city).toHaveValue("3");
  expect(city).toBeEnabled();
  expect(screen.getByRole("button", { name: "შენახვა" })).toBeEnabled();
  fireEvent.change(screen.getByRole("combobox", { name: "მხარე" }), { target: { value: "1" } });
  await waitFor(() => expect(readCities).toHaveBeenCalledTimes(3));
  await act(async () => resolveOld({ data: CITIES_BY_REGION[2]! }));
  expect(city).toHaveValue("3");
});

it.each(["returned", "rejected"])(
  "focuses and announces a %s save error while retaining edits",
  async (failure) => {
    if (failure === "returned")
      updateProfileAction.mockResolvedValueOnce({
        ok: false,
        error: "რაღაც შეცდომა მოხდა — სცადე თავიდან.",
      });
    else updateProfileAction.mockRejectedValueOnce(new Error("offline"));
    renderForm("სტუდენტი");
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "ქალაქი / მუნიციპალიტეტი" })).toHaveValue("3"),
    );
    const firstName = screen.getByRole("textbox", { name: "სახელი" });
    fireEvent.change(firstName, { target: { value: "ანა" } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveFocus();
    expect(firstName).toHaveValue("ანა");
    expect(screen.getByRole("button", { name: "შენახვა" })).toBeEnabled();
  },
);
