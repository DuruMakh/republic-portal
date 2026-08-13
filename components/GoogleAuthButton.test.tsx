import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOAuthMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithOAuth: signInWithOAuthMock },
  }),
}));

import { GoogleAuthButton } from "./GoogleAuthButton";

beforeEach(() => {
  signInWithOAuthMock.mockReset();
  signInWithOAuthMock.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GoogleAuthButton", () => {
  it("renders the official Google mark as part of one accessible provider action", () => {
    render(<GoogleAuthButton nextPath="/join" label="Google-ით გაგრძელება" />);

    const button = screen.getByRole("button", { name: "Google-ით გაგრძელება" });
    expect(button).toHaveAttribute("aria-busy", "false");
    const mark = screen.getByTestId("google-mark");
    expect(mark).toHaveAttribute("alt", "");
    expect(mark.getAttribute("src")).toContain("google-g.png");
  });

  it("starts Supabase Google OAuth with the current origin and preserved join path", async () => {
    render(<GoogleAuthButton nextPath="/join?ref=D00101" label="Google-ით გაგრძელება" />);
    vi.stubGlobal("window", {
      location: { origin: "https://portal.test", href: "https://portal.test/" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Google-ით გაგრძელება" }));
    vi.unstubAllGlobals();

    await waitFor(() =>
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "https://portal.test/auth/callback?next=%2Fjoin%3Fref%3DD00101",
        },
      }),
    );
  });

  it("disables while OAuth is pending", () => {
    signInWithOAuthMock.mockReturnValue(new Promise(() => undefined));
    render(<GoogleAuthButton nextPath="/join" label="Google-ით გაგრძელება" />);

    fireEvent.click(screen.getByRole("button", { name: "Google-ით გაგრძელება" }));

    const button = screen.getByRole("button", { name: "Google-ით გაგრძელება" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("recovers and shows one Georgian error line when OAuth fails", async () => {
    signInWithOAuthMock.mockResolvedValue({ error: { message: "provider unavailable" } });
    render(<GoogleAuthButton nextPath="/join" label="Google-ით გაგრძელება" />);

    fireEvent.click(screen.getByRole("button", { name: "Google-ით გაგრძელება" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Google-ით შესვლა ვერ მოხერხდა — სცადეთ თავიდან.",
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Google-ით გაგრძელება" })).toBeEnabled();
  });
});
