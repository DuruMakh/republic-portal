import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SupportForm } from "./SupportForm";
import {
  SUPPORT_FAILURE,
  SUPPORT_FILL_FIELD,
  SUPPORT_NEED_CONTACT,
  SUPPORT_RATE_LIMITED,
  SUPPORT_SUBMIT_LABEL,
  SUPPORT_SUCCESS,
} from "@/lib/support-copy";

// Georgian fixtures spliced, never retyped: NAME from lib/admin-schemas.test.ts:127,
// the "ა".repeat(n) idiom from lib/cabinet-schemas.test.ts:28.
const NAME = "ნინო";
const MESSAGE = "ა".repeat(20);

function fill(over: { name?: string; email?: string; phone?: string; message?: string } = {}) {
  fireEvent.change(screen.getByLabelText(/სახელი/), { target: { value: over.name ?? NAME } });
  fireEvent.change(screen.getByLabelText(/ელ-ფოსტა/), { target: { value: over.email ?? "" } });
  fireEvent.change(screen.getByLabelText(/ტელეფონი/), { target: { value: over.phone ?? "" } });
  fireEvent.change(screen.getByLabelText(/შეტყობინება/), {
    target: { value: over.message ?? MESSAGE },
  });
}

describe("SupportForm", () => {
  it("refuses to submit when neither email nor phone is given", async () => {
    const submit = vi.fn();
    render(<SupportForm submit={submit} />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: SUPPORT_SUBMIT_LABEL }));
    expect(await screen.findByText(SUPPORT_NEED_CONTACT)).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("submits with only a phone and shows the success line", async () => {
    const submit = vi.fn().mockResolvedValue({ ok: true });
    render(<SupportForm submit={submit} />);
    fill({ phone: "+995555123456" });
    fireEvent.click(screen.getByRole("button", { name: SUPPORT_SUBMIT_LABEL }));
    expect(await screen.findByText(SUPPORT_SUCCESS)).toBeInTheDocument();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("replaces the form with the success line so a message cannot be double-sent", async () => {
    const submit = vi.fn().mockResolvedValue({ ok: true });
    render(<SupportForm submit={submit} />);
    fill({ email: "someone@example.com" });
    fireEvent.click(screen.getByRole("button", { name: SUPPORT_SUBMIT_LABEL }));
    await screen.findByText(SUPPORT_SUCCESS);
    expect(screen.queryByRole("button", { name: SUPPORT_SUBMIT_LABEL })).not.toBeInTheDocument();
  });

  it("shows the server's error and keeps what was typed", async () => {
    const submit = vi.fn().mockResolvedValue({ ok: false, error: SUPPORT_RATE_LIMITED });
    render(<SupportForm submit={submit} />);
    fill({ email: "someone@example.com" });
    fireEvent.click(screen.getByRole("button", { name: SUPPORT_SUBMIT_LABEL }));
    expect(await screen.findByText(SUPPORT_RATE_LIMITED)).toBeInTheDocument();
    expect(screen.getByLabelText(/შეტყობინება/)).toHaveValue(MESSAGE);
  });

  // Code-review regressions (2026-08-02).
  it("re-enables the button and explains itself when the action REJECTS", async () => {
    // Network loss, or a stale action id after a redeploy. This used to leave
    // the button disabled forever with no message and the text unrecoverable.
    const submit = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    render(<SupportForm submit={submit} />);
    fill({ email: "someone@example.com" });
    const button = screen.getByRole("button", { name: SUPPORT_SUBMIT_LABEL });
    fireEvent.click(button);
    expect(await screen.findByText(SUPPORT_FAILURE)).toBeInTheDocument();
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(screen.getByLabelText(/შეტყობინება/)).toHaveValue(MESSAGE);
  });

  it("attaches each error to its own field instead of one anonymous line", async () => {
    const submit = vi.fn();
    render(<SupportForm submit={submit} />);
    // Two problems at once: no name AND no way to reply.
    fill({ name: "", email: "", phone: "" });
    fireEvent.click(screen.getByRole("button", { name: SUPPORT_SUBMIT_LABEL }));
    // Both surface together, and each marks its own control invalid.
    expect(await screen.findByText(SUPPORT_FILL_FIELD)).toBeInTheDocument();
    expect(screen.getByText(SUPPORT_NEED_CONTACT)).toBeInTheDocument();
    expect(screen.getByLabelText(/სახელი/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/ელ-ფოსტა/)).toHaveAttribute("aria-invalid", "true");
    expect(submit).not.toHaveBeenCalled();
  });

  it("disables the button while in flight", async () => {
    let release: (v: { ok: true }) => void = () => {};
    const submit = vi.fn().mockReturnValue(new Promise<{ ok: true }>((r) => (release = r)));
    render(<SupportForm submit={submit} />);
    fill({ email: "someone@example.com" });
    const button = screen.getByRole("button", { name: SUPPORT_SUBMIT_LABEL });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    release({ ok: true });
    await screen.findByText(SUPPORT_SUCCESS);
  });
});
