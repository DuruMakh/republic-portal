import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: mocks.createServerSupabase,
}));

import { GET } from "./route";

function callbackRequest(query = ""): Request {
  return new Request(`https://portal.test/auth/callback${query}`);
}

function expectRedirect(response: Response, path: string): void {
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe(`https://portal.test${path}`);
}

beforeEach(() => {
  mocks.createServerSupabase.mockReset();
  mocks.exchangeCodeForSession.mockReset();
  mocks.rpc.mockReset();
  mocks.createServerSupabase.mockResolvedValue({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
    rpc: mocks.rpc,
  });
  mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
});

describe("GET /auth/callback", () => {
  it("rejects a callback without a PKCE code before creating a Supabase client", async () => {
    const response = await GET(callbackRequest());

    expectRedirect(response, "/login?error=oauth_callback");
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  });

  it("returns to the login retry screen when the PKCE exchange fails", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid code" } });

    const response = await GET(callbackRequest("?code=bad"));

    expectRedirect(response, "/login?error=oauth_callback");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("routes an existing profile through the existing cabinet destination logic", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        exists: true,
        standing: "member",
        role: "member",
        delegateStatus: null,
      },
      error: null,
    });

    const response = await GET(callbackRequest("?code=good&next=%2Fjoin%3Fref%3DD00101"));

    expectRedirect(response, "/me/profile");
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("good");
    expect(mocks.rpc).toHaveBeenCalledWith("cabinet_state");
  });

  it("preserves a validated join path for a new profile", async () => {
    mocks.rpc.mockResolvedValue({ data: { exists: false }, error: null });

    const response = await GET(callbackRequest("?code=good&next=%2Fjoin%3Fref%3DD00101"));

    expectRedirect(response, "/join?ref=D00101");
  });

  it("routes a new profile to /join when next is a safe non-join path", async () => {
    mocks.rpc.mockResolvedValue({ data: { exists: false }, error: null });

    const response = await GET(callbackRequest("?code=good&next=%2Fme"));

    expectRedirect(response, "/join");
  });

  it("never turns an external next value into a redirect target", async () => {
    mocks.rpc.mockResolvedValue({ data: { exists: false }, error: null });

    const response = await GET(
      callbackRequest("?code=good&next=https%3A%2F%2Fevil.example%2Fsteal"),
    );

    expectRedirect(response, "/join");
  });

  it("shows an account lookup error when cabinet_state fails or is empty", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });

    const response = await GET(callbackRequest("?code=good"));

    expectRedirect(response, "/login?error=account_lookup");
  });

  it("normalizes an unexpected PKCE exchange exception to the safe retry screen", async () => {
    mocks.exchangeCodeForSession.mockRejectedValue(new Error("configuration unavailable"));

    const response = await GET(callbackRequest("?code=good"));

    expectRedirect(response, "/login?error=oauth_callback");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
