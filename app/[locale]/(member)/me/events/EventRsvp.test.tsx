import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rsvpMock = vi.fn();
vi.mock("./actions", () => ({ rsvpAction: (input: unknown) => rsvpMock(input) }));
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

import { EventRsvp } from "./EventRsvp";

const EVENT_ID = "6f1b0a9e-0000-4000-8000-00000000000e";

describe("EventRsvp", () => {
  beforeEach(() => {
    rsvpMock.mockReset();
    refreshMock.mockReset();
  });

  it("submits going=true from მოვალ and going=false from the going state's cancel", async () => {
    rsvpMock.mockResolvedValue({ ok: true });
    const { rerender } = render(<EventRsvp eventId={EVENT_ID} status={null} open />);
    fireEvent.click(screen.getByRole("button", { name: "მოვალ" }));
    await waitFor(() => expect(rsvpMock).toHaveBeenCalledWith({ eventId: EVENT_ID, going: true }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());

    rerender(<EventRsvp eventId={EVENT_ID} status="going" open />);
    expect(screen.getByText("✓ შენ მოდიხარ")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "გაუქმება" }));
    await waitFor(() => expect(rsvpMock).toHaveBeenCalledWith({ eventId: EVENT_ID, going: false }));
  });

  it("renders the lock text instead of controls when closed", () => {
    render(<EventRsvp eventId={EVENT_ID} status="going" open={false} />);
    expect(screen.getByText("რეგისტრაცია დახურულია")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("surfaces the server's Georgian error inline", async () => {
    rsvpMock.mockResolvedValue({ ok: false, error: "რეგისტრაცია ამ ღონისძიებაზე დახურულია." });
    render(<EventRsvp eventId={EVENT_ID} status={null} open />);
    fireEvent.click(screen.getByRole("button", { name: "მოვალ" }));
    expect(await screen.findByText("რეგისტრაცია ამ ღონისძიებაზე დახურულია.")).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
