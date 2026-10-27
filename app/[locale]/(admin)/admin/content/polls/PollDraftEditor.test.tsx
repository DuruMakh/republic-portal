import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PollActions } from "./PollActions";
import { PollDraftEditor } from "./PollDraftEditor";
const mocks = vi.hoisted(() => ({ save: vi.fn(), publish: vi.fn(), refresh: vi.fn() }));
vi.mock("./actions", () => ({
  savePollAction: mocks.save,
  openPollAction: mocks.publish,
  closePollAction: vi.fn(),
  deletePollAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
}));
const record = { id: "p1", question: "Question", options: ["Yes", "No"], endsAtLocal: "" };
function Editor() {
  return <PollDraftEditor poll={record} />;
}
const edit = (value: string) =>
  fireEvent.change(screen.getByLabelText("კითხვა"), { target: { value } });
const publish = () => screen.getByRole("button", { name: "გახსნა" });
const save = () => fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue({ ok: true, id: record.id });
  mocks.publish.mockResolvedValue({ ok: true });
});
describe("saved polls editor", () => {
  it("blocks publication after editing, and allows edit then revert", () => {
    render(<Editor />);
    expect(publish()).toBeEnabled();
    edit("Updated");
    expect(publish()).toBeDisabled();
    fireEvent.click(publish());
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(screen.getByText("ჯერ შეინახე ცვლილებები.")).toBeVisible();
    edit("Question");
    expect(publish()).toBeEnabled();
  });
  it("enables publication after a successful save, and clears stale saved feedback on edit", async () => {
    render(<Editor />);
    edit("Updated");
    save();
    await screen.findByText("შენახულია.");
    await waitFor(() => expect(publish()).toBeEnabled());
    await act(async () => {
      fireEvent.click(publish());
    });
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith(record.id));
    edit("Another change");
    expect(publish()).toBeDisabled();
    expect(screen.queryByText("შენახულია.")).not.toBeInTheDocument();
  });
  it("keeps publication blocked after a failed save", async () => {
    mocks.save.mockResolvedValue({ ok: false, error: "Save failed" });
    render(<Editor />);
    edit("Updated");
    save();
    await screen.findByText("Save failed");
    expect(publish()).toBeDisabled();
  });
  it("acknowledges only submitted values when edited during a pending save", async () => {
    let finish!: (value: { ok: true; id: string }) => void;
    mocks.save.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<Editor />);
    edit("Updated");
    save();
    expect(publish()).toBeDisabled();
    edit("Second edit");
    await act(async () => finish({ ok: true, id: record.id }));
    expect(publish()).toBeDisabled();
    expect(screen.queryByText("შენახულია.")).not.toBeInTheDocument();
    edit("Updated");
    expect(publish()).toBeEnabled();
  });
  it("normalizes whitespace before comparing saved text", () => {
    render(<Editor />);
    edit("  Question  ");
    expect(publish()).toBeEnabled();
  });
});

it("blocks publication during a save even without edits", async () => {
  let finish!: (value: { ok: true; id: string }) => void;
  mocks.save.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<Editor />);
  save();
  expect(publish()).toBeDisabled();
  await act(async () => finish({ ok: true, id: record.id }));
  await waitFor(() => expect(publish()).toBeEnabled());
});
it.each(["option", "deadline", "addition"])("blocks opening after %s changes", (field) => {
  render(<Editor />);
  if (field === "option")
    fireEvent.change(screen.getByLabelText("პასუხი 1"), { target: { value: "Changed" } });
  else if (field === "deadline")
    fireEvent.change(screen.getByLabelText("ბოლო ვადა (არასავალდებულო)"), {
      target: { value: "2027-01-01T12:00" },
    });
  else fireEvent.click(screen.getByRole("button", { name: "პასუხის დამატება" }));
  expect(publish()).toBeDisabled();
  fireEvent.click(publish());
  expect(mocks.publish).not.toHaveBeenCalled();
});
it("keeps close confirmation available even when openBlocked is passed", () => {
  render(<PollActions id="p1" status="open" openBlocked />);
  fireEvent.click(screen.getByRole("button", { name: "დახურვა" }));
  expect(screen.getByRole("button", { name: "დაადასტურე დახურვა" })).toBeEnabled();
});
