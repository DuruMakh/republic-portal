import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.fn();
vi.mock("./actions", () => ({ saveEventAction: (input: unknown) => saveMock(input) }));
const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { EventForm } from "./EventForm";

describe("EventForm", () => {
  beforeEach(() => {
    saveMock.mockReset();
    pushMock.mockReset();
  });

  it("creating: submits Tbilisi wall-time strings verbatim", async () => {
    saveMock.mockResolvedValue({ ok: true, id: "e-new" });
    render(<EventForm event={null} />);
    fireEvent.change(screen.getByLabelText("დასახელება"), { target: { value: "კრება" } });
    fireEvent.change(screen.getByLabelText("ადგილმდებარეობა"), { target: { value: "თბილისი" } });
    fireEvent.change(screen.getByLabelText("დაწყება"), { target: { value: "2026-08-01T19:00" } });
    fireEvent.change(screen.getByLabelText("აღწერა"), { target: { value: "დღის წესრიგი." } });
    fireEvent.click(screen.getByRole("button", { name: "შენახვა" }));
    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith({
        id: undefined,
        title: "კრება",
        description: "დღის წესრიგი.",
        location: "თბილისი",
        startsAt: "2026-08-01T19:00",
        endsAt: "",
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/admin/content/events/e-new"));
  });

  it("editing: prefills the datetime-local values it was given", () => {
    render(
      <EventForm
        event={{
          id: "e1",
          title: "ძველი",
          description: "აღწერა",
          location: "ქუთაისი",
          startsAtLocal: "2026-08-01T19:00",
          endsAtLocal: "2026-08-01T21:00",
        }}
      />,
    );
    expect(screen.getByLabelText("დაწყება")).toHaveValue("2026-08-01T19:00");
    expect(screen.getByLabelText("დასრულება (არასავალდებულო)")).toHaveValue("2026-08-01T21:00");
  });
});
