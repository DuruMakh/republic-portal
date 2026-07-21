import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OtpVerification } from "./OtpVerification";

const verifyOtpMock = vi.fn();
const signInWithOtpMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      verifyOtp: (arg: unknown) => verifyOtpMock(arg),
      signInWithOtp: (arg: unknown) => signInWithOtpMock(arg),
    },
  }),
}));

const PHONE = "+995555123456";

beforeEach(() => {
  verifyOtpMock.mockReset();
  signInWithOtpMock.mockReset();
  verifyOtpMock.mockResolvedValue({ error: null });
  signInWithOtpMock.mockResolvedValue({ error: null });
});

describe("OtpVerification.verify", () => {
  it("verifies the code and calls onVerified", async () => {
    const onVerified = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    render(<OtpVerification phone={PHONE} onVerified={onVerified} />);
    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "123456" } });
    const confirm = screen.getByRole("button", { name: "დადასტურება" });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(verifyOtpMock).toHaveBeenCalledWith({ phone: PHONE, token: "123456", type: "sms" }),
    );
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(confirm).not.toBeDisabled());
  });

  it("shows the Georgian error and re-enables the button on a wrong code", async () => {
    verifyOtpMock.mockResolvedValue({ error: { message: "invalid otp" } });
    const onVerified = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    render(<OtpVerification phone={PHONE} onVerified={onVerified} />);
    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "000000" } });
    const confirm = screen.getByRole("button", { name: "დადასტურება" });
    fireEvent.click(confirm);
    expect(await screen.findByText("კოდი არასწორია")).toBeInTheDocument();
    expect(onVerified).not.toHaveBeenCalled();
    expect(confirm).not.toBeDisabled();
  });

  it("releases the button in a finally even when onVerified rejects (defense in depth)", async () => {
    // In production JoinForm's afterVerify catches its own failure, so onVerified never
    // rejects — but verify() must still never strand the button if it did. mockRejected-
    // ValueOnce (the precise one-call simulation) matches the house style for rejection
    // tests in this Vitest+jsdom setup (see TierChange.test.tsx).
    const onVerified = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error("boom"));
    render(<OtpVerification phone={PHONE} onVerified={onVerified} />);
    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "123456" } });
    const confirm = screen.getByRole("button", { name: "დადასტურება" });
    fireEvent.click(confirm);
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(confirm).not.toBeDisabled());
  });
});
