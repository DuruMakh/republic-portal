import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PHONE_VERIFICATION_MESSAGES } from "@/lib/phone-verification/contracts";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("@/app/(public)/join/phone-actions", () => ({
  sendPhoneVerificationAction: mocks.send,
  verifyPhoneVerificationAction: mocks.verify,
}));

import { PhoneVerification } from "./PhoneVerification";

const PHONE = "+995555123456";
const CHALLENGE_ID = "11111111-1111-4111-8111-111111111111";
const NEW_CHALLENGE_ID = "22222222-2222-4222-8222-222222222222";
const EXPIRES_AT = "2026-08-11T12:05:00.000Z";
const NEW_EXPIRES_AT = "2026-08-11T12:06:00.000Z";

function renderVerification(
  overrides: {
    onChallengeChanged?: (challenge: { challengeId: string; expiresAt: string }) => void;
    onVerified?: (phone: string) => void | Promise<void>;
  } = {},
) {
  const onChallengeChanged = overrides.onChallengeChanged ?? vi.fn();
  const onVerified = overrides.onVerified ?? vi.fn();
  render(
    <PhoneVerification
      phone={PHONE}
      challengeId={CHALLENGE_ID}
      expiresAt={EXPIRES_AT}
      onChallengeChanged={onChallengeChanged}
      onVerified={onVerified}
    />,
  );
  return { onChallengeChanged, onVerified };
}

beforeEach(() => {
  mocks.send.mockReset();
  mocks.verify.mockReset();
  mocks.verify.mockResolvedValue({ ok: true, phone: PHONE });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PhoneVerification", () => {
  it("rejects a non-six-digit code before calling the verify action", () => {
    renderVerification();

    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "დადასტურება" }));

    expect(screen.getByText("შეიყვანე 6-ნიშნა კოდი")).toBeInTheDocument();
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("submits only the sealed challenge id and six-digit code", async () => {
    renderVerification();

    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "დადასტურება" }));

    await waitFor(() =>
      expect(mocks.verify).toHaveBeenCalledWith({ challengeId: CHALLENGE_ID, code: "123456" }),
    );
  });

  it.each([
    ["invalid_code", PHONE_VERIFICATION_MESSAGES.invalid_code],
    ["expired_code", PHONE_VERIFICATION_MESSAGES.expired_code],
    ["service_unavailable", PHONE_VERIFICATION_MESSAGES.service_unavailable],
  ] as const)("shows the approved %s recovery message", async (code, message) => {
    mocks.verify.mockResolvedValue({ ok: false, code, message });
    renderVerification();

    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "დადასტურება" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("keeps resend disabled for exactly 60 seconds, then replaces the challenge after success", async () => {
    vi.useFakeTimers();
    mocks.send.mockResolvedValue({
      ok: true,
      challengeId: NEW_CHALLENGE_ID,
      phone: PHONE,
      expiresAt: NEW_EXPIRES_AT,
    });
    const { onChallengeChanged } = renderVerification();
    const resend = screen.getByRole("button", { name: "ხელახლა გაგზავნა (60წმ)" });

    expect(resend).toBeDisabled();
    act(() => vi.advanceTimersByTime(59_000));
    expect(screen.getByRole("button", { name: "ხელახლა გაგზავნა (1წმ)" })).toBeDisabled();
    act(() => vi.advanceTimersByTime(1_000));

    const enabledResend = screen.getByRole("button", { name: "ხელახლა გაგზავნა" });
    expect(enabledResend).toBeEnabled();
    fireEvent.click(enabledResend);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.send).toHaveBeenCalledWith({ phone: PHONE });
    expect(onChallengeChanged).toHaveBeenCalledWith({
      challengeId: NEW_CHALLENGE_ID,
      expiresAt: NEW_EXPIRES_AT,
    });
    expect(screen.getByRole("button", { name: "ხელახლა გაგზავნა (60წმ)" })).toBeDisabled();
  });

  it("does not restart the cooldown when resend fails", async () => {
    vi.useFakeTimers();
    mocks.send.mockResolvedValue({
      ok: false,
      code: "service_unavailable",
      message: PHONE_VERIFICATION_MESSAGES.service_unavailable,
    });
    renderVerification();
    act(() => vi.advanceTimersByTime(60_000));

    fireEvent.click(screen.getByRole("button", { name: "ხელახლა გაგზავნა" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(PHONE_VERIFICATION_MESSAGES.service_unavailable)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ხელახლა გაგზავნა" })).toBeEnabled();
  });

  it("shows the normalized phone and invokes onVerified exactly once", async () => {
    const onVerified = vi.fn<(_phone: string) => Promise<void>>().mockResolvedValue(undefined);
    renderVerification({ onVerified });

    expect(screen.getByText(PHONE, { exact: false })).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "123456" } });
    const confirm = screen.getByRole("button", { name: "დადასტურება" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect(onVerified).toHaveBeenCalledWith(PHONE);
  });

  it("re-enables confirmation after a rejected verified callback", async () => {
    const onVerified = vi
      .fn<(_phone: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("callback failed"));
    renderVerification({ onVerified });
    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "123456" } });
    const confirm = screen.getByRole("button", { name: "დადასტურება" });

    fireEvent.click(confirm);

    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(confirm).toBeEnabled());
  });
});
