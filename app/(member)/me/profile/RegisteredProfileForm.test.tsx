import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegisteredProfileForm } from "./RegisteredProfileForm";

const updateRegisteredNameAction = vi.fn();
vi.mock("../actions", () => ({
  updateRegisteredNameAction: (input: unknown) => updateRegisteredNameAction(input),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function renderForm() {
  return render(
    <RegisteredProfileForm
      initial={{ firstName: "ნინო", lastName: "ბერიძე" }}
      phone="995599123456"
      personalIdMasked="010********"
    />,
  );
}

describe("RegisteredProfileForm", () => {
  it("prefills names; phone is formatted read-only; PID shows the server-masked value", () => {
    renderForm();
    expect(screen.getByLabelText("სახელი")).toHaveValue("ნინო");
    expect(screen.getByLabelText("გვარი")).toHaveValue("ბერიძე");
    expect(screen.getByTestId("profile-phone")).toHaveValue("+995 599 12 34 56");
    expect(screen.getByTestId("profile-phone")).toHaveAttribute("readonly");
    expect(screen.getByTestId("profile-pid")).toHaveValue("010********");
    expect(screen.getByTestId("profile-pid")).toHaveAttribute("readonly");
  });

  it("rejects an empty name in Georgian without calling the action", async () => {
    updateRegisteredNameAction.mockClear();
    renderForm();
    fireEvent.change(screen.getByLabelText("სახელი"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    expect(await screen.findByText("შეავსე ეს ველი")).toBeInTheDocument();
    expect(updateRegisteredNameAction).not.toHaveBeenCalled();
  });

  it("rejects a too-long name with the max-60 message without calling the action", async () => {
    updateRegisteredNameAction.mockClear();
    renderForm();
    fireEvent.change(screen.getByLabelText("გვარი"), { target: { value: "ა".repeat(61) } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    expect(await screen.findByText("მაქსიმუმ 60 სიმბოლო")).toBeInTheDocument();
    expect(updateRegisteredNameAction).not.toHaveBeenCalled();
  });

  it("submits trimmed names, confirms in Georgian, and clears the notice on edit", async () => {
    updateRegisteredNameAction.mockClear();
    updateRegisteredNameAction.mockResolvedValue({ ok: true });
    renderForm();
    fireEvent.change(screen.getByLabelText("სახელი"), { target: { value: " გიორგი " } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() => expect(updateRegisteredNameAction).toHaveBeenCalled());
    expect(updateRegisteredNameAction.mock.calls[0]?.[0]).toMatchObject({
      firstName: "გიორგი",
      lastName: "ბერიძე",
    });
    expect(await screen.findByTestId("profile-saved")).toHaveTextContent("პროფილი განახლდა ✓");
    fireEvent.change(screen.getByLabelText("გვარი"), { target: { value: "მაისურაძე" } });
    expect(screen.queryByTestId("profile-saved")).toBeNull();
  });

  it("disables the save button while the action is pending", async () => {
    updateRegisteredNameAction.mockClear();
    let resolveAction!: (value: { ok: true }) => void;
    updateRegisteredNameAction.mockImplementation(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          resolveAction = resolve;
        }),
    );
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "შენახვა" })).toBeDisabled());
    resolveAction({ ok: true });
    await waitFor(() => expect(screen.getByRole("button", { name: "შენახვა" })).toBeEnabled());
    expect(screen.getByTestId("profile-saved")).toBeInTheDocument();
  });

  it("shows the server error when the action fails", async () => {
    updateRegisteredNameAction.mockClear();
    updateRegisteredNameAction.mockResolvedValue({
      ok: false,
      error: "სესია ამოიწურა — დაადასტურე ნომერი თავიდან.",
    });
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    expect(
      await screen.findByText("სესია ამოიწურა — დაადასტურე ნომერი თავიდან."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("profile-saved")).toBeNull();
  });
});
