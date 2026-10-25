import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewsEditor } from "./NewsEditor";
const mocks = vi.hoisted(() => ({ save: vi.fn(), publish: vi.fn(), refresh: vi.fn() }));
vi.mock("./actions", () => ({
  saveNewsAction: mocks.save,
  publishNewsAction: mocks.publish,
  unpublishNewsAction: vi.fn(),
  deleteNewsAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
}));
vi.mock("./CoverUpload", () => ({ CoverUpload: () => null }));
const record = { id: "a1", title: "Title", body: "Body", visibility: "public" as const };
function Editor() {
  return <NewsEditor article={record} status="draft" everPublished={false} imageUrl={null} />;
}
const edit = (value: string) =>
  fireEvent.change(screen.getByLabelText("სათაური"), { target: { value } });
const publish = () => screen.getByRole("button", { name: "გამოქვეყნება" });
const save = () => fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue({ ok: true, id: record.id });
  mocks.publish.mockResolvedValue({ ok: true });
});
describe("saved news editor", () => {
  it("blocks publication after editing, and allows edit then revert", () => {
    render(<Editor />);
    expect(publish()).toBeEnabled();
    edit("Updated");
    expect(publish()).toBeDisabled();
    fireEvent.click(publish());
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(screen.getByText("ჯერ შეინახე ცვლილებები.")).toBeVisible();
    edit("Title");
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
    edit("  Title  ");
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
it.each(["visibility", "body"])("blocks publishing after %s changes", (field) => {
  render(<Editor />);
  if (field === "visibility") fireEvent.click(screen.getByLabelText("წევრებისთვის"));
  else fireEvent.change(screen.getByLabelText("ტექსტი"), { target: { value: "Changed body" } });
  expect(publish()).toBeDisabled();
  fireEvent.click(publish());
  expect(mocks.publish).not.toHaveBeenCalled();
});
it("keeps unpublish available while the published article has edits", () => {
  render(<NewsEditor article={record} status="published" everPublished={true} imageUrl={null} />);
  edit("Changed");
  expect(screen.getByRole("button", { name: "მოხსნა" })).toBeEnabled();
});
