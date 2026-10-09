import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_DELETE_CANCEL,
  ADMIN_DELETE_CONFIRM,
  ADMIN_DELETE_DONE,
  ADMIN_DELETE_NAME_LABEL,
  ADMIN_DELETE_REASON_HINT,
  ADMIN_DELETE_REASON_LABEL,
} from "@/lib/account-deletion-copy";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { DeleteMemberButton } from "./DeleteMemberButton";
import type { deleteMemberAction } from "./delete-member-actions";

type Action = typeof deleteMemberAction;
type Result = Awaited<ReturnType<Action>>;

const MEMBER_ID = "11111111-1111-4111-8111-111111111111";
const NAME = "Nino Beridze";
const REASON = "member asked by email";
const REFUSAL = "refused by the database";

function setup(action: Action = vi.fn<Action>().mockResolvedValue({ ok: true })) {
  render(<DeleteMemberButton memberId={MEMBER_ID} memberName={NAME} action={action} />);
  return action;
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: ADMIN_DELETE_BUTTON }));
}
function typeReason(value: string) {
  fireEvent.change(screen.getByLabelText(ADMIN_DELETE_REASON_LABEL), { target: { value } });
}
function typeName(value: string) {
  fireEvent.change(screen.getByLabelText(ADMIN_DELETE_NAME_LABEL), { target: { value } });
}
function confirmButton() {
  return screen.getByRole("button", { name: ADMIN_DELETE_CONFIRM });
}
function fillValid() {
  typeReason(REASON);
  typeName(NAME);
}

describe("DeleteMemberButton — the form is hidden until the row's button is clicked", () => {
  it("shows only the delete button at first", () => {
    setup();
    expect(screen.getByRole("button", { name: ADMIN_DELETE_BUTTON })).toBeInTheDocument();
    expect(screen.queryByLabelText(ADMIN_DELETE_REASON_LABEL)).toBeNull();
    expect(screen.queryByLabelText(ADMIN_DELETE_NAME_LABEL)).toBeNull();
    expect(screen.queryByRole("button", { name: ADMIN_DELETE_CONFIRM })).toBeNull();
    expect(screen.queryByText(ADMIN_DELETE_REASON_HINT)).toBeNull();
  });

  it("opens the reason field, the name field, a disabled confirm and a cancel", () => {
    setup();
    open();
    expect(screen.getByLabelText(ADMIN_DELETE_REASON_LABEL)).toBeInTheDocument();
    expect(screen.getByLabelText(ADMIN_DELETE_NAME_LABEL)).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: ADMIN_DELETE_CANCEL })).toBeEnabled();
  });

  it("tells staff, under the reason field, not to write the person's name in it", () => {
    setup();
    open();
    // the member.delete audit row keeps the reason after the erasure (ADR-049)
    const hint = screen.getByText(ADMIN_DELETE_REASON_HINT);
    expect(hint).toBeVisible();
    const reason = screen.getByLabelText(ADMIN_DELETE_REASON_LABEL);
    expect(reason).toHaveAccessibleDescription(ADMIN_DELETE_REASON_HINT);
    // under the field, not above it
    expect(reason.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("closes again and forgets what was typed on cancel", () => {
    const action = setup();
    open();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: ADMIN_DELETE_CANCEL }));
    expect(screen.queryByLabelText(ADMIN_DELETE_REASON_LABEL)).toBeNull();
    expect(screen.getByRole("button", { name: ADMIN_DELETE_BUTTON })).toBeInTheDocument();
    open();
    expect(screen.getByLabelText(ADMIN_DELETE_REASON_LABEL)).toHaveValue("");
    expect(screen.getByLabelText(ADMIN_DELETE_NAME_LABEL)).toHaveValue("");
    expect(action).not.toHaveBeenCalled();
  });
});

describe("DeleteMemberButton — confirm is gated on the reason and the typed name", () => {
  it("stays disabled until the reason has 5 characters after trimming", () => {
    setup();
    open();
    typeName(NAME);
    typeReason("abcd");
    expect(confirmButton()).toBeDisabled();
    typeReason("   abcd   ");
    expect(confirmButton()).toBeDisabled();
    typeReason("abcde");
    expect(confirmButton()).toBeEnabled();
  });

  it("stays disabled until the typed name matches the member's, trimmed and exact", () => {
    setup();
    open();
    typeReason(REASON);
    expect(confirmButton()).toBeDisabled();
    typeName("Nino");
    expect(confirmButton()).toBeDisabled();
    typeName("nino beridze");
    expect(confirmButton()).toBeDisabled();
    typeName(`  ${NAME}  `);
    expect(confirmButton()).toBeEnabled();
  });

  it("limits the reason to the 300 characters the database accepts", () => {
    setup();
    open();
    expect(screen.getByLabelText(ADMIN_DELETE_REASON_LABEL)).toHaveAttribute("maxlength", "300");
  });

  it("does not call the action when a disabled confirm is clicked", () => {
    const action = setup();
    open();
    typeReason(REASON);
    fireEvent.click(confirmButton());
    expect(action).not.toHaveBeenCalled();
  });
});

describe("DeleteMemberButton — sending the request", () => {
  it("sends the member id, the reason, the typed name and the expected name", async () => {
    const action = setup();
    open();
    fillValid();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(action).toHaveBeenCalledWith(MEMBER_ID, REASON, NAME, NAME));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("shows the done message on success and closes the form", async () => {
    setup();
    open();
    fillValid();
    fireEvent.click(confirmButton());
    expect(await screen.findByText(ADMIN_DELETE_DONE)).toBeInTheDocument();
    expect(screen.queryByLabelText(ADMIN_DELETE_REASON_LABEL)).toBeNull();
    expect(screen.queryByRole("button", { name: ADMIN_DELETE_CONFIRM })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a refusal in an alert and lets the admin try again", async () => {
    const action = vi
      .fn<Action>()
      .mockResolvedValueOnce({ ok: false, error: REFUSAL })
      .mockResolvedValueOnce({ ok: true });
    setup(action);
    open();
    fillValid();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(REFUSAL));
    // still open, with what was typed, and not frozen
    expect(screen.getByLabelText(ADMIN_DELETE_REASON_LABEL)).toHaveValue(REASON);
    expect(confirmButton()).toBeEnabled();
    expect(screen.queryByText(ADMIN_DELETE_DONE)).toBeNull();
    fireEvent.click(confirmButton());
    expect(await screen.findByText(ADMIN_DELETE_DONE)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not freeze when the action throws: generic alert, buttons usable again", async () => {
    const action = vi.fn<Action>().mockRejectedValue(new Error("network down"));
    setup(action);
    open();
    fillValid();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(GENERIC_FUNNEL_ERROR));
    expect(confirmButton()).toBeEnabled();
    expect(screen.getByRole("button", { name: ADMIN_DELETE_CANCEL })).toBeEnabled();
  });

  it("locks the buttons and the fields while the request is running", async () => {
    let finish: (v: Result) => void = () => {};
    const slow = vi.fn<Action>(
      () =>
        new Promise<Result>((resolve) => {
          finish = resolve;
        }),
    );
    setup(slow);
    open();
    fillValid();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(slow).toHaveBeenCalledTimes(1));
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: ADMIN_DELETE_CANCEL })).toBeDisabled();
    // a second click while busy must not send a second request
    fireEvent.click(confirmButton());
    expect(slow).toHaveBeenCalledTimes(1);
    finish({ ok: false, error: REFUSAL });
    await waitFor(() => expect(confirmButton()).toBeEnabled());
    expect(screen.getByRole("button", { name: ADMIN_DELETE_CANCEL })).toBeEnabled();
  });

  it("clears an earlier refusal when the admin cancels and reopens", async () => {
    setup(vi.fn<Action>().mockResolvedValue({ ok: false, error: REFUSAL }));
    open();
    fillValid();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: ADMIN_DELETE_CANCEL }));
    open();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
