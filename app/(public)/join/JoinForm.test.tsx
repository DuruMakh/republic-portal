import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DUPLICATE_PERSONAL_ID_MESSAGE,
  GENERIC_FUNNEL_ERROR,
  NOT_AUTHENTICATED_MESSAGE,
  type CabinetStatePresent,
} from "@/lib/funnel";

// register() server action — the one boundary this component talks to after the OTP.
const registerAction = vi.fn();
vi.mock("./actions", () => ({
  registerAction: (input: unknown) => registerAction(input),
}));

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(),
}));

// Supabase browser client: getUser (on-mount redirect probe), signInWithOtp (the
// SMS send — asserted to fire exactly once so we can prove "no second SMS"), and
// verifyOtp (OTP proof, always succeeds in these tests).
const getUserMock = vi.fn();
const signInWithOtpMock = vi.fn();
const verifyOtpMock = vi.fn();
const rpcMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => getUserMock(),
      signInWithOtp: (arg: unknown) => signInWithOtpMock(arg),
      verifyOtp: (arg: unknown) => verifyOtpMock(arg),
    },
    rpc: (name: string) => rpcMock(name),
  }),
}));

import JoinForm from "./JoinForm";

function presentState(overrides: Partial<CabinetStatePresent> = {}): CabinetStatePresent {
  return {
    exists: true,
    standing: "registered",
    status: "registered",
    role: "member",
    firstName: "ნინო",
    lastName: "ბერიძე",
    personalIdMasked: "010********",
    birthDate: null,
    regionId: null,
    cityId: null,
    employment: null,
    tier: null,
    referenceCode: null,
    completed: false,
    delegateStatus: null,
    referral: null,
    pendingDelegate: null,
    chosenDelegate: null,
    membershipExists: false,
    registrationCompletedAt: null,
    createdAt: "2026-07-21T10:00:00Z",
    admin: false,
    created: true,
    ...overrides,
  };
}

// Fills the form, sends + proves the OTP, and clicks დადასტურება — driving the flow
// to exactly the point where afterVerify calls registerAction. The per-test
// registerAction mock must be primed before calling this.
async function driveToRegister() {
  render(<JoinForm />);
  fireEvent.change(screen.getByLabelText("სახელი"), { target: { value: "ნინო" } });
  fireEvent.change(screen.getByLabelText("გვარი"), { target: { value: "ბერიძე" } });
  fireEvent.change(screen.getByLabelText("პირადი ნომერი"), { target: { value: "01001000000" } });
  fireEvent.change(screen.getByLabelText("ტელეფონის ნომერი"), { target: { value: "555123456" } });
  fireEvent.click(screen.getByRole("button", { name: "გაგრძელება →" }));
  const confirm = await screen.findByRole("button", { name: "დადასტურება" });
  fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "123456" } });
  fireEvent.click(confirm);
}

beforeEach(() => {
  registerAction.mockReset();
  replaceMock.mockReset();
  getUserMock.mockReset();
  signInWithOtpMock.mockReset();
  verifyOtpMock.mockReset();
  rpcMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: null } });
  signInWithOtpMock.mockResolvedValue({ error: null });
  verifyOtpMock.mockResolvedValue({ error: null });
});

describe("JoinForm — afterVerify failure handling (finding V10)", () => {
  it("catches a rejected registerAction: shows a Georgian error, drops to the proven retry phase, and sends no second SMS", async () => {
    // A rejected action promise (network blip / stale deployed Server Action) used to
    // propagate up and strand the OTP screen forever.
    registerAction.mockRejectedValueOnce(new Error("network"));
    await driveToRegister();

    expect(await screen.findByText(GENERIC_FUNNEL_ERROR)).toBeInTheDocument();
    // retry phase: the phone stays proven (disabled) and the button resubmits register()
    const retryButton = screen.getByRole("button", { name: "დარეგისტრირება" });
    expect(retryButton).toBeInTheDocument();
    expect(retryButton).not.toBeDisabled();
    expect(screen.getByLabelText("ტელეფონის ნომერი")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "გაგრძელება →" })).toBeNull();
    // the OTP was already proven — no fresh code was requested
    expect(signInWithOtpMock).toHaveBeenCalledTimes(1);
  });

  it("routes a generic/transient register() error to the retry phase (proven session), not back to a new OTP", async () => {
    registerAction.mockResolvedValueOnce({ ok: false, error: GENERIC_FUNNEL_ERROR });
    await driveToRegister();

    expect(await screen.findByText(GENERIC_FUNNEL_ERROR)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "დარეგისტრირება" })).toBeInTheDocument();
    expect(screen.getByLabelText("ტელეფონის ნომერი")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "გაგრძელება →" })).toBeNull();
    expect(signInWithOtpMock).toHaveBeenCalledTimes(1); // no second OTP
  });

  it("routes only a genuine not_authenticated error back to the form phase (fresh OTP)", async () => {
    registerAction.mockResolvedValueOnce({ ok: false, error: NOT_AUTHENTICATED_MESSAGE });
    await driveToRegister();

    expect(await screen.findByText(NOT_AUTHENTICATED_MESSAGE)).toBeInTheDocument();
    // form phase: the phone field is re-enabled and the button re-requests a code
    expect(screen.getByRole("button", { name: "გაგრძელება →" })).toBeInTheDocument();
    expect(screen.getByLabelText("ტელეფონის ნომერი")).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: "დარეგისტრირება" })).toBeNull();
  });

  it("duplicate personal ID surfaces as a field error in the retry phase, then corrects without a second SMS (regression)", async () => {
    registerAction.mockResolvedValueOnce({ ok: false, error: DUPLICATE_PERSONAL_ID_MESSAGE });
    await driveToRegister();

    expect(await screen.findByText(DUPLICATE_PERSONAL_ID_MESSAGE)).toBeInTheDocument();
    expect(screen.getByLabelText("ტელეფონის ნომერი")).toBeDisabled();
    const retryButton = screen.getByRole("button", { name: "დარეგისტრირება" });

    // fix the ID and resubmit via the proven session — success redirects to the cabinet
    registerAction.mockResolvedValueOnce({ ok: true, state: presentState() });
    fireEvent.change(screen.getByLabelText("პირადი ნომერი"), { target: { value: "02002000000" } });
    fireEvent.click(retryButton);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/me"));
    expect(registerAction).toHaveBeenCalledTimes(2);
    expect(signInWithOtpMock).toHaveBeenCalledTimes(1); // never a second SMS
  });

  it("a fresh registration redirects straight to the cabinet", async () => {
    registerAction.mockResolvedValueOnce({ ok: true, state: presentState() });
    await driveToRegister();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/me"));
  });
});
