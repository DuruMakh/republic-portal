import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ACCOUNT_DELETION_CONFIRM_WORD } from "@/lib/account-deletion";
import {
  ACCOUNT_DELETE_BUSY,
  ACCOUNT_DELETE_BUTTON,
  ACCOUNT_DELETE_CONFIRM_LABEL,
  ACCOUNT_DELETE_DELEGATE_NOTE,
  ACCOUNT_DELETE_HEADING,
  ACCOUNT_DELETE_LEDE,
  ACCOUNT_DELETE_STAFF_NOTE,
} from "@/lib/account-deletion-copy";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { DeleteAccountSection } from "./DeleteAccountSection";

type Result = { ok: false; error: string };
type Action = (input: unknown) => Promise<Result>;

const REFUSAL = "refused by the database";
const action = vi.fn<Action>().mockResolvedValue({ ok: false, error: REFUSAL });

function typeWord(value: string) {
  fireEvent.change(screen.getByLabelText(ACCOUNT_DELETE_CONFIRM_LABEL), { target: { value } });
}

describe("DeleteAccountSection", () => {
  it("shows the heading and the plain-language lede", () => {
    render(<DeleteAccountSection isStaff={false} isDelegate={false} action={action} />);
    expect(screen.getByRole("heading", { name: ACCOUNT_DELETE_HEADING })).toBeInTheDocument();
    expect(screen.getByText(ACCOUNT_DELETE_LEDE)).toBeInTheDocument();
  });

  it("keeps the button disabled until the word is typed exactly", () => {
    render(<DeleteAccountSection isStaff={false} isDelegate={false} action={action} />);
    const button = screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON });
    expect(button).toBeDisabled();
    typeWord("delete");
    expect(button).toBeDisabled();
    typeWord(ACCOUNT_DELETION_CONFIRM_WORD);
    expect(button).toBeEnabled();
  });

  it("sends the word and shows a refusal as an alert", async () => {
    action.mockClear();
    render(<DeleteAccountSection isStaff={false} isDelegate={false} action={action} />);
    typeWord(ACCOUNT_DELETION_CONFIRM_WORD);
    fireEvent.click(screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(REFUSAL));
    expect(action).toHaveBeenCalledWith({ confirm: ACCOUNT_DELETION_CONFIRM_WORD });
    // refused, so the member can try again
    expect(screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON })).toBeEnabled();
  });

  it("shows the busy label while the deletion is running", async () => {
    let finish: (v: Result) => void = () => {};
    const slow = vi.fn<Action>(
      () =>
        new Promise<Result>((resolve) => {
          finish = resolve;
        }),
    );
    render(<DeleteAccountSection isStaff={false} isDelegate={false} action={slow} />);
    typeWord(ACCOUNT_DELETION_CONFIRM_WORD);
    fireEvent.click(screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON }));
    const busy = await screen.findByRole("button", { name: ACCOUNT_DELETE_BUSY });
    expect(busy).toBeDisabled();
    finish({ ok: false, error: REFUSAL });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON })).toBeEnabled(),
    );
  });

  it("shows the generic message when the action fails unexpectedly", async () => {
    const broken = vi.fn<Action>().mockRejectedValue(new Error("network down"));
    render(<DeleteAccountSection isStaff={false} isDelegate={false} action={broken} />);
    typeWord(ACCOUNT_DELETION_CONFIRM_WORD);
    fireEvent.click(screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(GENERIC_FUNNEL_ERROR));
  });

  it("stays busy and silent when the deletion ends in the redirect to /account-deleted", async () => {
    // What Next's client hands back when a server action redirects: it has already started the
    // navigation, and rejects the action's promise with this marker (message NEXT_REDIRECT).
    const redirected = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;push;/account-deleted;307;",
    });
    const deleting = vi.fn<Action>().mockRejectedValue(redirected);
    render(<DeleteAccountSection isStaff={false} isDelegate={false} action={deleting} />);
    typeWord(ACCOUNT_DELETION_CONFIRM_WORD);
    fireEvent.click(screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON }));
    await waitFor(() => expect(deleting).toHaveBeenCalled());
    // let the rejection settle; a rethrow would surface as an unhandled rejection and fail the run
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("alert")).toBeNull();
    // no second click while the page changes: the button keeps its busy, disabled state
    expect(screen.getByRole("button", { name: ACCOUNT_DELETE_BUSY })).toBeDisabled();
  });

  it("tells a delegate their page goes and their team moves", () => {
    render(<DeleteAccountSection isStaff={false} isDelegate action={action} />);
    expect(screen.getByText(ACCOUNT_DELETE_DELEGATE_NOTE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON })).toBeInTheDocument();
  });

  it("does not show the delegate note to a plain member", () => {
    render(<DeleteAccountSection isStaff={false} isDelegate={false} action={action} />);
    expect(screen.queryByText(ACCOUNT_DELETE_DELEGATE_NOTE)).toBeNull();
    expect(screen.queryByText(ACCOUNT_DELETE_STAFF_NOTE)).toBeNull();
  });

  it("offers staff no field and no button, only the explanation", () => {
    render(<DeleteAccountSection isStaff isDelegate={false} action={action} />);
    expect(screen.getByText(ACCOUNT_DELETE_STAFF_NOTE)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByLabelText(ACCOUNT_DELETE_CONFIRM_LABEL)).toBeNull();
  });
});
