import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.fn();
vi.mock("./actions", () => ({ saveNewsAction: (input: unknown) => saveMock(input) }));
const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { NewsForm } from "./NewsForm";

describe("NewsForm", () => {
  beforeEach(() => {
    saveMock.mockReset();
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  it("live preview renders the body through the real renderer", () => {
    render(<NewsForm article={null} />);
    fireEvent.change(screen.getByLabelText("ტექსტი"), {
      target: { value: "პირველი.\n\nმეორე https://a.ge ბმულით." },
    });
    const preview = screen.getByTestId("news-preview");
    expect(preview.querySelectorAll("p")).toHaveLength(2);
    expect(preview.querySelector("a")).toHaveAttribute("href", "https://a.ge");
  });

  it("creating: submits title/visibility/body and navigates to the editor", async () => {
    saveMock.mockResolvedValue({ ok: true, id: "new-id" });
    render(<NewsForm article={null} />);
    fireEvent.change(screen.getByLabelText("სათაური"), { target: { value: "ახალი" } });
    fireEvent.click(screen.getByLabelText("წევრებისთვის"));
    fireEvent.change(screen.getByLabelText("ტექსტი"), { target: { value: "ტანი" } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith({
        id: undefined,
        title: "ახალი",
        body: "ტანი",
        visibility: "members",
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/content/news/new-id"));
  });

  it("editing: prefills and refreshes on save", async () => {
    saveMock.mockResolvedValue({ ok: true, id: "a1" });
    render(<NewsForm article={{ id: "a1", title: "ძველი", body: "ტანი", visibility: "public" }} />);
    expect(screen.getByLabelText("სათაური")).toHaveValue("ძველი");
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(await screen.findByText("შენახულია.")).toBeInTheDocument();
  });

  it("shows the server error inline", async () => {
    saveMock.mockResolvedValue({ ok: false, error: "სათაური არასწორია (1–160 სიმბოლო)." });
    render(<NewsForm article={null} />);
    fireEvent.change(screen.getByLabelText("სათაური"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("ტექსტი"), { target: { value: "y" } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    expect(await screen.findByText("სათაური არასწორია (1–160 სიმბოლო).")).toBeInTheDocument();
  });
});
