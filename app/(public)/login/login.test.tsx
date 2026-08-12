import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const signInWithOtpMock = vi.fn();
const signInWithOAuthMock = vi.fn();
const verifyOtpMock = vi.fn();
const rpcMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: (arg: unknown) => signInWithOtpMock(arg),
      signInWithOAuth: (arg: unknown) => signInWithOAuthMock(arg),
      verifyOtp: (arg: unknown) => verifyOtpMock(arg),
    },
    rpc: (name: string) => rpcMock(name),
  }),
}));

import LoginPage from "./page";

const ROUTE_ERROR_MESSAGE = "მონაცემების წამოღება ვერ მოხერხდა — სცადე თავიდან.";

async function renderLogin(error?: string) {
  const searchParams = error ? { error } : {};
  render(await LoginPage({ searchParams: Promise.resolve(searchParams) }));
}

async function driveLegacyToVerify(code = "123456") {
  await renderLogin();
  fireEvent.change(screen.getByLabelText("ტელეფონის ნომერი"), {
    target: { value: "555123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "კოდის მიღება" }));
  const confirm = await screen.findByRole("button", { name: "დადასტურება" });
  fireEvent.change(screen.getByTestId("otp-0"), { target: { value: code } });
  fireEvent.click(confirm);
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "phone");
  replaceMock.mockReset();
  signInWithOtpMock.mockReset();
  signInWithOAuthMock.mockReset();
  verifyOtpMock.mockReset();
  rpcMock.mockReset();
  signInWithOtpMock.mockResolvedValue({ error: null });
  signInWithOAuthMock.mockResolvedValue({ error: null });
  verifyOtpMock.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("LoginPage rollout selector", () => {
  it("defaults to the unchanged phone login when the setting is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "");

    await renderLogin();

    expect(screen.getByLabelText("ტელეფონის ნომერი")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "კოდის მიღება" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Google-ით შესვლა" })).toBeNull();
  });

  it("keeps the phone login when the setting is exactly phone", async () => {
    await renderLogin();

    expect(screen.getByLabelText("ტელეფონის ნომერი")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "კოდის მიღება" })).toBeInTheDocument();
  });

  it("shows only Google login in google mode and defers cabinet lookup to the callback", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "google");

    await renderLogin("oauth_callback");

    expect(screen.getAllByRole("button", { name: "Google-ით შესვლა" })).toHaveLength(1);
    expect(screen.queryByLabelText("ტელეფონის ნომერი")).toBeNull();
    expect(screen.queryByTestId("otp-0")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Google-ით შესვლა ვერ მოხერხდა — სცადეთ თავიდან.",
    );
    expect(screen.getByRole("heading", { name: "შესვლა" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "რეგისტრაციის ნაბიჯები" })).toBeNull();
    expect(screen.getByRole("complementary")).toHaveAccessibleName("პირველად ხარ?");
    expect(screen.getByText("Google-ით შედიხარ უსაფრთხოდ და სწრაფად.")).toBeInTheDocument();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("LegacyPhoneLogin cabinet_state lookup failure surface", () => {
  it("shows the Georgian lookup error and does not bounce to /join", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    await driveLegacyToVerify();

    expect(await screen.findByText(ROUTE_ERROR_MESSAGE)).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("treats null data without an error object as a lookup failure", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    await driveLegacyToVerify();

    expect(await screen.findByText(ROUTE_ERROR_MESSAGE)).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("still routes a successful lookup to the derived destination", async () => {
    rpcMock.mockResolvedValueOnce({ data: { exists: false }, error: null });

    await driveLegacyToVerify();

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/join"));
    expect(screen.queryByText(ROUTE_ERROR_MESSAGE)).toBeNull();
  });

  it("retries only the lookup on the live session and never reuses the SMS token", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await driveLegacyToVerify();
    expect(await screen.findByText(ROUTE_ERROR_MESSAGE)).toBeInTheDocument();

    rpcMock.mockResolvedValueOnce({ data: { exists: false }, error: null });
    fireEvent.click(screen.getByRole("button", { name: "სცადე თავიდან" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/join"));
    expect(screen.queryByText(ROUTE_ERROR_MESSAGE)).toBeNull();
    expect(verifyOtpMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });
});
