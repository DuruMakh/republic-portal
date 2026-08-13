import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_FUNNEL_ERROR, type CabinetStatePresent } from "@/lib/funnel";
import { PHONE_VERIFICATION_MESSAGES } from "@/lib/phone-verification/contracts";

const mocks = vi.hoisted(() => {
  const replace = vi.fn();
  return {
    search: "",
    replace,
    router: { replace },
    getUser: vi.fn(),
    rpc: vi.fn(),
    signInWithOtp: vi.fn(),
    verifyOtp: vi.fn(),
    signInWithOAuth: vi.fn(),
    refreshSession: vi.fn(),
    legacyRegister: vi.fn(),
    sendPhone: vi.fn(),
    verifyPhone: vi.fn(),
    registerGoogle: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mocks.getUser,
      signInWithOtp: mocks.signInWithOtp,
      verifyOtp: mocks.verifyOtp,
      signInWithOAuth: mocks.signInWithOAuth,
      refreshSession: mocks.refreshSession,
    },
    rpc: mocks.rpc,
  }),
}));

vi.mock("./actions", () => ({ registerAction: mocks.legacyRegister }));
vi.mock("./phone-actions", () => ({
  sendPhoneVerificationAction: mocks.sendPhone,
  verifyPhoneVerificationAction: mocks.verifyPhone,
}));
vi.mock("./google-actions", () => ({ registerGoogleAction: mocks.registerGoogle }));

import JoinForm from "./JoinForm";

const PHONE = "+995555123456";
const CHALLENGE_ID = "11111111-1111-4111-8111-111111111111";
const EXPIRES_AT = "2026-08-11T12:05:00.000Z";

function presentState(overrides: Partial<CabinetStatePresent> = {}): CabinetStatePresent {
  return {
    exists: true,
    standing: "registered",
    status: "registered",
    role: "member",
    firstName: "ნინო",
    lastName: "ბერიძე",
    personalIdMasked: "********",
    hasPersonalId: false,
    referralCode: null,
    referralCount: 0,
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

function googleUser(overrides: { phone?: string | null; phone_confirmed_at?: string | null } = {}) {
  return {
    id: "google-user-id",
    phone: overrides.phone ?? null,
    phone_confirmed_at: overrides.phone_confirmed_at ?? null,
    app_metadata: { providers: ["google"] },
  };
}

async function renderJoin() {
  render(<JoinForm />);
  await Promise.resolve();
}

function expectCurrentRegistrationStep(label: "Google" | "ტელეფონი") {
  const progress = screen.getByRole("list", { name: "რეგისტრაციის ნაბიჯები" });
  expect(within(progress).getByText(label).closest("li")).toHaveAttribute("aria-current", "step");
}

async function reachGoogleForm(user = googleUser()) {
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.rpc.mockResolvedValue({ data: { exists: false }, error: null });
  await renderJoin();
  await screen.findByLabelText("სახელი");
}

async function sendGoogleCode() {
  await reachGoogleForm();
  fireEvent.change(screen.getByLabelText("სახელი"), { target: { value: "ნინო" } });
  fireEvent.change(screen.getByLabelText("გვარი"), { target: { value: "ბერიძე" } });
  fireEvent.change(screen.getByLabelText("ტელეფონის ნომერი"), {
    target: { value: "555123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "კოდის მიღება" }));
  await screen.findByRole("button", { name: "დადასტურება" });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "google");
  mocks.search = "";
  mocks.replace.mockReset();
  mocks.getUser.mockReset();
  mocks.rpc.mockReset();
  mocks.signInWithOtp.mockReset();
  mocks.verifyOtp.mockReset();
  mocks.signInWithOAuth.mockReset();
  mocks.refreshSession.mockReset();
  mocks.legacyRegister.mockReset();
  mocks.sendPhone.mockReset();
  mocks.verifyPhone.mockReset();
  mocks.registerGoogle.mockReset();
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.rpc.mockResolvedValue({ data: { exists: false }, error: null });
  mocks.signInWithOtp.mockResolvedValue({ error: null });
  mocks.verifyOtp.mockResolvedValue({ error: null });
  mocks.signInWithOAuth.mockResolvedValue({ error: null });
  mocks.refreshSession.mockResolvedValue({
    data: { user: googleUser({ phone: PHONE, phone_confirmed_at: EXPIRES_AT }), session: {} },
    error: null,
  });
  mocks.sendPhone.mockResolvedValue({
    ok: true,
    challengeId: CHALLENGE_ID,
    phone: PHONE,
    expiresAt: EXPIRES_AT,
  });
  mocks.verifyPhone.mockResolvedValue({ ok: true, phone: PHONE });
  mocks.registerGoogle.mockResolvedValue({ ok: true, state: presentState() });
});

afterEach(() => {
  vi.unstubAllEnvs();
  window.localStorage.clear();
});

describe("JoinForm rollout selector", () => {
  it("defaults to the unchanged legacy phone form when the setting is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "");
    await renderJoin();

    expect(screen.getByRole("heading", { name: "პირადი მონაცემები" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "გაგრძელება →" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Google-ით გაგრძელება" })).toBeNull();
  });

  it("keeps the unchanged legacy phone form when the setting is exactly phone", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "phone");
    await renderJoin();

    expect(screen.getByRole("button", { name: "გაგრძელება →" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Google-ით გაგრძელება" })).toBeNull();
  });

  it("selects Google only from the environment, never query or local storage", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MODE", "phone");
    mocks.search = "?auth=google";
    window.localStorage.setItem("auth-mode", "google");
    await renderJoin();

    expect(screen.getByRole("button", { name: "გაგრძელება →" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Google-ით გაგრძელება" })).toBeNull();
  });

  it("renders the Google-first flow only in exact google mode", async () => {
    await renderJoin();

    expect(await screen.findByRole("button", { name: "Google-ით გაგრძელება" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "გაგრძელება →" })).toBeNull();
  });
});

describe("GoogleJoinForm", () => {
  it("keeps the Google step current while registration state loads", () => {
    mocks.getUser.mockReturnValue(new Promise(() => undefined));

    render(<JoinForm />);

    expectCurrentRegistrationStep("Google");
    expect(screen.getByText("ნაბიჯი 1 — წევრის რეგისტრაცია")).toBeInTheDocument();
  });

  it("shows only the Google gate when signed out and preserves a valid referral through OAuth", async () => {
    mocks.search = "?ref=D00101";
    await renderJoin();

    const google = await screen.findByRole("button", { name: "Google-ით გაგრძელება" });
    expectCurrentRegistrationStep("Google");
    expect(screen.getByRole("complementary")).toHaveAccessibleName("როგორ მუშაობს");
    expect(screen.queryByLabelText("სახელი")).toBeNull();
    expect(screen.queryByLabelText("ტელეფონის ნომერი")).toBeNull();
    fireEvent.click(google);

    await waitFor(() =>
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: expect.stringContaining("next=%2Fjoin%3Fref%3DD00101"),
        },
      }),
    );
  });

  it("routes a signed-in existing account to its derived cabinet destination", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: googleUser() }, error: null });
    mocks.rpc.mockResolvedValue({
      data: presentState({ standing: "member", completed: true }),
      error: null,
    });
    await renderJoin();

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/me/profile"));
    expect(screen.queryByLabelText("ტელეფონის ნომერი")).toBeNull();
  });

  it("shows the name and phone form for a Google user without a profile", async () => {
    await reachGoogleForm();

    expectCurrentRegistrationStep("ტელეფონი");
    expect(screen.queryByText("ნაბიჯი 2 — ტელეფონის დადასტურება")).toBeNull();
    expect(screen.queryByRole("heading", { name: "შემოგვიერთდი ერთ წუთში" })).toBeNull();
    expect(
      screen.queryByText("Google-ით იწყებ, ტელეფონის ნომერს კი მხოლოდ ერთხელ ადასტურებ."),
    ).toBeNull();
    expect(screen.queryByRole("heading", { name: "პირადი მონაცემები" })).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.getByLabelText("სახელი")).toBeEnabled();
    expect(screen.getByLabelText("გვარი")).toBeEnabled();
    expect(screen.getByLabelText("ტელეფონის ნომერი")).toHaveValue("");
  });

  it("resumes a consumed phone proof after reload without sending a second SMS", async () => {
    await reachGoogleForm(googleUser({ phone: PHONE, phone_confirmed_at: EXPIRES_AT }));
    fireEvent.change(screen.getByLabelText("სახელი"), { target: { value: "ნინო" } });
    fireEvent.change(screen.getByLabelText("გვარი"), { target: { value: "ბერიძე" } });

    expect(screen.getByLabelText("ტელეფონის ნომერი")).toHaveValue(PHONE);
    fireEvent.click(screen.getByRole("button", { name: "კოდის მიღება" }));

    await waitFor(() => expect(mocks.registerGoogle).toHaveBeenCalledTimes(1));
    expect(mocks.registerGoogle).toHaveBeenCalledWith({
      firstName: "ნინო",
      lastName: "ბერიძე",
      refCode: null,
    });
    expect(mocks.sendPhone).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/me");
  });

  it("sends exactly one SMS when the confirmed phone has no consumed proof", async () => {
    mocks.registerGoogle.mockResolvedValueOnce({
      ok: false,
      code: "phone_required",
      error: "რეგისტრაციისთვის საჭიროა დადასტურებული მობილურის ნომერი.",
    });
    await reachGoogleForm(googleUser({ phone: PHONE, phone_confirmed_at: EXPIRES_AT }));
    fireEvent.change(screen.getByLabelText("სახელი"), { target: { value: "ნინო" } });
    fireEvent.change(screen.getByLabelText("გვარი"), { target: { value: "ბერიძე" } });
    fireEvent.click(screen.getByRole("button", { name: "კოდის მიღება" }));

    await waitFor(() => expect(mocks.registerGoogle).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.sendPhone).toHaveBeenCalledTimes(1));
    expect(mocks.sendPhone).toHaveBeenCalledWith({ phone: PHONE });
    expect(await screen.findByRole("button", { name: "დადასტურება" })).toBeInTheDocument();
  });

  it("sends no SMS when an adversarial preflight error fails closed", async () => {
    mocks.registerGoogle.mockResolvedValueOnce({
      ok: false,
      code: "service_unavailable",
      error: GENERIC_FUNNEL_ERROR,
    });
    await reachGoogleForm(googleUser({ phone: PHONE, phone_confirmed_at: EXPIRES_AT }));
    fireEvent.change(screen.getByLabelText("სახელი"), { target: { value: "ნინო" } });
    fireEvent.change(screen.getByLabelText("გვარი"), { target: { value: "ბერიძე" } });
    fireEvent.click(screen.getByRole("button", { name: "კოდის მიღება" }));

    expect(await screen.findByText(GENERIC_FUNNEL_ERROR)).toBeInTheDocument();
    expect(mocks.sendPhone).not.toHaveBeenCalled();
    expect(screen.getByLabelText("ტელეფონის ნომერი")).toBeEnabled();
  });

  it("does not preflight a changed phone against the unrelated confirmed phone", async () => {
    await reachGoogleForm(googleUser({ phone: PHONE, phone_confirmed_at: EXPIRES_AT }));
    fireEvent.change(screen.getByLabelText("სახელი"), { target: { value: "ნინო" } });
    fireEvent.change(screen.getByLabelText("გვარი"), { target: { value: "ბერიძე" } });
    fireEvent.change(screen.getByLabelText("ტელეფონის ნომერი"), {
      target: { value: "555654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: "კოდის მიღება" }));

    await waitFor(() => expect(mocks.sendPhone).toHaveBeenCalledWith({ phone: "+995555654321" }));
    expect(mocks.registerGoogle).not.toHaveBeenCalled();
  });

  it("moves a successful send to the provider-neutral code screen", async () => {
    await sendGoogleCode();

    expectCurrentRegistrationStep("ტელეფონი");
    expect(screen.getByText(PHONE, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "SMS კოდი" })).toBeInTheDocument();
    expect(screen.queryByText("Supabase", { exact: false })).toBeNull();
  });

  it("refreshes the Google session before registering the same authenticated identity", async () => {
    const order: string[] = [];
    mocks.refreshSession.mockImplementation(async () => {
      order.push("refresh");
      return {
        data: { user: googleUser({ phone: PHONE, phone_confirmed_at: EXPIRES_AT }), session: {} },
        error: null,
      };
    });
    mocks.registerGoogle.mockImplementation(async () => {
      order.push("register");
      return { ok: true, state: presentState() };
    });
    mocks.search = "?ref=D00101";
    await sendGoogleCode();
    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "დადასტურება" }));

    await waitFor(() => expect(mocks.registerGoogle).toHaveBeenCalledTimes(1));
    expect(order).toEqual(["refresh", "register"]);
    expect(mocks.registerGoogle).toHaveBeenCalledWith({
      firstName: "ნინო",
      lastName: "ბერიძე",
      refCode: "D00101",
    });
    expect(mocks.replace).toHaveBeenCalledWith("/me");
  });

  it("keeps verified phone proof for registration retry and sends no second SMS", async () => {
    mocks.registerGoogle
      .mockResolvedValueOnce({
        ok: false,
        code: "service_unavailable",
        error: GENERIC_FUNNEL_ERROR,
      })
      .mockResolvedValueOnce({ ok: true, state: presentState() });
    await sendGoogleCode();
    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "დადასტურება" }));

    expect(await screen.findByText(GENERIC_FUNNEL_ERROR)).toBeInTheDocument();
    expectCurrentRegistrationStep("ტელეფონი");
    expect(screen.getByLabelText("ტელეფონის ნომერი")).toBeDisabled();
    const retry = screen.getByRole("button", { name: "დარეგისტრირება" });
    fireEvent.click(retry);

    await waitFor(() => expect(mocks.registerGoogle).toHaveBeenCalledTimes(2));
    expect(mocks.sendPhone).toHaveBeenCalledTimes(1);
    expect(mocks.verifyPhone).toHaveBeenCalledTimes(1);
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("returns a lost Google session to the Google phase instead of phone OTP", async () => {
    mocks.sendPhone.mockResolvedValue({
      ok: false,
      code: "not_authenticated",
      message: PHONE_VERIFICATION_MESSAGES.not_authenticated,
    });
    await reachGoogleForm();
    fireEvent.change(screen.getByLabelText("სახელი"), { target: { value: "ნინო" } });
    fireEvent.change(screen.getByLabelText("გვარი"), { target: { value: "ბერიძე" } });
    fireEvent.change(screen.getByLabelText("ტელეფონის ნომერი"), {
      target: { value: "555123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "კოდის მიღება" }));

    expect(await screen.findByRole("button", { name: "Google-ით გაგრძელება" })).toBeInTheDocument();
    expect(screen.queryByTestId("otp-0")).toBeNull();
  });

  it("surfaces a duplicate phone without registration or redirect", async () => {
    mocks.verifyPhone.mockResolvedValue({
      ok: false,
      code: "phone_in_use",
      message: PHONE_VERIFICATION_MESSAGES.phone_in_use,
    });
    await sendGoogleCode();
    fireEvent.change(screen.getByTestId("otp-0"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "დადასტურება" }));

    expect(await screen.findByText(PHONE_VERIFICATION_MESSAGES.phone_in_use)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ნომრის შეცვლა" }));

    expect(screen.getByLabelText("ტელეფონის ნომერი")).toBeEnabled();
    expect(screen.getByRole("button", { name: "კოდის მიღება" })).toBeInTheDocument();
    expect(mocks.registerGoogle).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("plainly discloses Verify.ge's one-time use of the phone number", async () => {
    await reachGoogleForm();

    expect(
      screen.getByText(
        "Verify.ge ნომერს მიიღებს მხოლოდ რეგისტრაციის ერთჯერადი კოდის გასაგზავნად და დასადასტურებლად.",
      ),
    ).toBeInTheDocument();
  });
});
