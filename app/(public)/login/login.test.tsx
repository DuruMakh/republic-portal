import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

// Supabase browser client: signInWithOtp (the SMS send), verifyOtp (OTP proof,
// always succeeds in these tests — only the post-verify cabinet_state lookup
// varies), and rpc (cabinet_state).
const signInWithOtpMock = vi.fn();
const verifyOtpMock = vi.fn();
const rpcMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: (arg: unknown) => signInWithOtpMock(arg),
      verifyOtp: (arg: unknown) => verifyOtpMock(arg),
    },
    rpc: (name: string) => rpcMock(name),
  }),
}));

import LoginPage from "./page";

// R2 §7c: a lapsed/failed cabinet_state lookup must surface this message, not
// silently bounce an existing member to /join. Byte-spliced from the task-3
// brief — see .superpowers/sdd/task-3-brief.md Step 4.
const ROUTE_ERROR_MESSAGE = "მონაცემების წამოღება ვერ მოხერხდა — სცადე თავიდან.";

// Renders the page, fills the phone field, requests a code, and submits a
// 6-digit OTP — driving the flow to exactly the point where
// routeByCabinetState runs (mirrors JoinForm.test.tsx's driveToRegister).
async function driveToVerify(code = "123456") {
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText("ტელეფონის ნომერი"), {
    target: { value: "555123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "კოდის მიღება" }));
  const confirm = await screen.findByRole("button", { name: "დადასტურება" });
  fireEvent.change(screen.getByTestId("otp-0"), { target: { value: code } });
  fireEvent.click(confirm);
}

beforeEach(() => {
  replaceMock.mockReset();
  signInWithOtpMock.mockReset();
  verifyOtpMock.mockReset();
  rpcMock.mockReset();
  signInWithOtpMock.mockResolvedValue({ error: null });
  verifyOtpMock.mockResolvedValue({ error: null });
});

describe("LoginPage — cabinet_state lookup failure surface (R2 §7c)", () => {
  it("shows the Georgian lookup error and does not bounce to /join", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    await driveToVerify();

    expect(await screen.findByText(ROUTE_ERROR_MESSAGE)).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("a null data payload (no error object) is treated the same as an rpc error", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    await driveToVerify();

    expect(await screen.findByText(ROUTE_ERROR_MESSAGE)).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("a successful lookup still routes to the derived destination (no regression)", async () => {
    rpcMock.mockResolvedValueOnce({ data: { exists: false }, error: null });

    await driveToVerify();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/join"));
    expect(screen.queryByText(ROUTE_ERROR_MESSAGE)).toBeNull();
  });

  it("retry re-runs ONLY the lookup on the live session — never verifyOtp (the SMS token is single-use)", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await driveToVerify();
    expect(await screen.findByText(ROUTE_ERROR_MESSAGE)).toBeInTheDocument();

    rpcMock.mockResolvedValueOnce({ data: { exists: false }, error: null });
    fireEvent.click(screen.getByRole("button", { name: "სცადე თავიდან" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/join"));
    expect(screen.queryByText(ROUTE_ERROR_MESSAGE)).toBeNull();
    // the consumed OTP must not be re-submitted: one verify for the whole journey
    expect(verifyOtpMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });
});
