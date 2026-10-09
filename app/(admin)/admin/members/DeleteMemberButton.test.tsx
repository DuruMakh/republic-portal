import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_DELETE_CANCEL,
  ADMIN_DELETE_CONFIRM,
  ADMIN_DELETE_DONE,
  ADMIN_DELETE_NAME_LABEL,
  ADMIN_DELETE_NAME_MISMATCH,
  ADMIN_DELETE_REASON_HINT,
  ADMIN_DELETE_REASON_LABEL,
} from "@/lib/account-deletion-copy";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { DeleteMemberButton } from "./DeleteMemberButton";
import type { deleteMemberAction } from "./delete-member-actions";

// the list refresh that follows a deletion goes through the router (current URL + deleted=1)
const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: "/admin/members",
  search: "",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

beforeEach(() => {
  nav.replace.mockReset();
  nav.search = "";
});

type Action = typeof deleteMemberAction;
type Result = Awaited<ReturnType<Action>>;

const MEMBER_ID = "11111111-1111-4111-8111-111111111111";
const NAME = "Nino Beridze";
const NBSP = String.fromCharCode(0xa0);
const REASON = "member asked by email";
const REFUSAL = "refused by the database";

function setup(
  action: Action = vi.fn<Action>().mockResolvedValue({ ok: true }),
  memberName: string = NAME,
) {
  render(<DeleteMemberButton memberId={MEMBER_ID} memberName={memberName} action={action} />);
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

  it("moves focus to the reason field when the form opens (the button it replaces had it)", () => {
    setup();
    open();
    expect(screen.getByLabelText(ADMIN_DELETE_REASON_LABEL)).toHaveFocus();
  });

  it("points out a name that does not match once the admin leaves the field, not while typing", () => {
    setup();
    open();
    typeReason(REASON);
    const field = screen.getByLabelText(ADMIN_DELETE_NAME_LABEL);
    typeName("Nino Ber");
    expect(screen.queryByText(ADMIN_DELETE_NAME_MISMATCH)).toBeNull();
    fireEvent.blur(field);
    expect(screen.getByText(ADMIN_DELETE_NAME_MISMATCH)).toBeInTheDocument();
    expect(field).toBeInvalid();
    typeName(NAME);
    expect(screen.queryByText(ADMIN_DELETE_NAME_MISMATCH)).toBeNull();
    expect(field).toBeValid();
  });

  it("says nothing about the name while the field is empty", () => {
    setup();
    open();
    fireEvent.blur(screen.getByLabelText(ADMIN_DELETE_NAME_LABEL));
    expect(screen.queryByText(ADMIN_DELETE_NAME_MISMATCH)).toBeNull();
  });

  it("closes again and forgets what was typed on cancel", () => {
    const action = setup();
    open();
    typeReason(REASON);
    typeName("Nino");
    fireEvent.blur(screen.getByLabelText(ADMIN_DELETE_NAME_LABEL));
    expect(screen.getByText(ADMIN_DELETE_NAME_MISMATCH)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: ADMIN_DELETE_CANCEL }));
    expect(screen.queryByLabelText(ADMIN_DELETE_REASON_LABEL)).toBeNull();
    expect(screen.getByRole("button", { name: ADMIN_DELETE_BUTTON })).toBeInTheDocument();
    open();
    expect(screen.getByLabelText(ADMIN_DELETE_REASON_LABEL)).toHaveValue("");
    expect(screen.getByLabelText(ADMIN_DELETE_NAME_LABEL)).toHaveValue("");
    expect(screen.queryByText(ADMIN_DELETE_NAME_MISMATCH)).toBeNull();
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

  it.each([
    { label: "two spaces inside the stored name", stored: "Nino  Beridze" },
    { label: "a non-breaking space inside the stored name", stored: `Nino${NBSP}Beridze` },
    { label: "a trailing non-breaking space on the stored name", stored: `${NAME}${NBSP}` },
  ])("accepts the name as the page shows it despite $label", async ({ stored }) => {
    const action = setup(undefined, stored);
    open();
    typeReason(REASON);
    typeName(NAME);
    expect(confirmButton()).toBeEnabled();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(action).toHaveBeenCalledWith(MEMBER_ID, REASON, NAME, stored));
  });

  it("accepts a typed name with doubled spaces", () => {
    setup();
    open();
    typeReason(REASON);
    typeName("Nino  Beridze");
    expect(confirmButton()).toBeEnabled();
  });

  it("never enables confirm for a member whose stored name is blank", () => {
    setup(undefined, `  ${NBSP} `);
    open();
    typeReason(REASON);
    typeName("   ");
    expect(confirmButton()).toBeDisabled();
    typeName("x");
    expect(confirmButton()).toBeDisabled();
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

  it("refreshes the list with deleted=1 after a success, keeping the current filters", async () => {
    nav.search = "search=Nino&regionId=3&page=2";
    setup();
    open();
    fillValid();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(nav.replace).toHaveBeenCalledTimes(1));
    // replace, not push or redirect: no back-button state that re-shows the deleted row,
    // and the page stays scrolled where the admin was
    expect(nav.replace).toHaveBeenCalledWith(
      "/admin/members?search=Nino&regionId=3&page=2&deleted=1",
      { scroll: false },
    );
  });

  it("refreshes to a bare deleted=1 when no filter is set", async () => {
    setup();
    open();
    fillValid();
    fireEvent.click(confirmButton());
    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith("/admin/members?deleted=1", { scroll: false }),
    );
  });

  it("does not repeat deleted=1 when the list already shows the notice", async () => {
    nav.search = "deleted=1&search=Nino";
    setup();
    open();
    fillValid();
    fireEvent.click(confirmButton());
    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith("/admin/members?deleted=1&search=Nino", {
        scroll: false,
      }),
    );
  });

  it("leaves the URL alone when the deletion is refused", async () => {
    setup(vi.fn<Action>().mockResolvedValue({ ok: false, error: REFUSAL }));
    open();
    fillValid();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(REFUSAL));
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("leaves the URL alone when the action throws", async () => {
    setup(vi.fn<Action>().mockRejectedValue(new Error("network down")));
    open();
    fillValid();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(GENERIC_FUNNEL_ERROR));
    expect(nav.replace).not.toHaveBeenCalled();
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
