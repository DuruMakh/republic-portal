import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileForm } from "./ProfileForm";

const updateProfileAction = vi.fn();
vi.mock("../actions", () => ({
  updateProfileAction: (input: unknown) => updateProfileAction(input),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [
                { id: 3, name_ka: "თბილისი" },
                { id: 4, name_ka: "რუსთავი" },
              ],
            }),
        }),
      }),
    }),
  }),
}));

const REGIONS = [
  { id: 1, name_ka: "თბილისი" },
  { id: 2, name_ka: "იმერეთი" },
];

function renderForm(employment: string) {
  return render(
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
    />,
  );
}

describe("ProfileForm", () => {
  it("prefills preset employment; phone is formatted read-only; PID fully masked", async () => {
    renderForm("სტუდენტი");
    expect(screen.getByLabelText("სახელი")).toHaveValue("ნინო");
    expect(screen.getByLabelText("სამუშაო ადგილი / სტატუსი")).toHaveValue("სტუდენტი");
    expect(screen.getByTestId("profile-phone")).toHaveValue("+995 599 12 34 56");
    expect(screen.getByTestId("profile-phone")).toHaveAttribute("readonly");
    expect(screen.getByTestId("profile-pid")).toHaveValue("•••••••••••");
    await waitFor(() => expect(screen.getByLabelText("ქალაქი / მუნიციპალიტეტი")).toHaveValue("3"));
  });

  it("non-preset employment renders as „სხვა“ with the custom text", () => {
    renderForm("მეწარმე");
    expect(screen.getByLabelText("სამუშაო ადგილი / სტატუსი")).toHaveValue("__other");
    expect(screen.getByLabelText("მიუთითე საქმიანობა")).toHaveValue("მეწარმე");
  });

  it("submits the mapped employment and confirms in Georgian", async () => {
    updateProfileAction.mockResolvedValue({ ok: true, state: {} });
    renderForm("სტუდენტი");
    await waitFor(() => expect(screen.getByLabelText("ქალაქი / მუნიციპალიტეტი")).toHaveValue("3"));
    fireEvent.change(screen.getByLabelText("სამუშაო ადგილი / სტატუსი"), {
      target: { value: "__other" },
    });
    fireEvent.change(screen.getByLabelText("მიუთითე საქმიანობა"), {
      target: { value: "მეწარმე" },
    });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() => expect(updateProfileAction).toHaveBeenCalled());
    expect(updateProfileAction.mock.calls[0]?.[0]).toMatchObject({ employment: "მეწარმე" });
    expect(await screen.findByTestId("profile-saved")).toHaveTextContent("პროფილი განახლდა ✓");
  });
});
