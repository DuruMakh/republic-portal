import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSignedIn } from "./useSignedIn";

type TestSession = { user: { id: string } } | null;
type AuthListener = (event: string, session: TestSession) => void;

const { getSession, onAuthStateChange, unsubscribe } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession, onAuthStateChange } }),
}));

describe("useSignedIn", () => {
  beforeEach(() => {
    getSession.mockReset();
    onAuthStateChange.mockReset();
    unsubscribe.mockReset();
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
  });

  it("starts signed out and applies the initial session resolution", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });

    const { result } = renderHook(() => useSignedIn());

    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("applies later auth-state events", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    let listener: AuthListener | undefined;
    onAuthStateChange.mockImplementation((next: AuthListener) => {
      listener = next;
      return { data: { subscription: { unsubscribe } } };
    });
    const { result } = renderHook(() => useSignedIn());
    await waitFor(() => expect(onAuthStateChange).toHaveBeenCalledTimes(1));

    act(() => listener?.("SIGNED_IN", { user: { id: "u1" } }));
    expect(result.current).toBe(true);
    act(() => listener?.("SIGNED_OUT", null));
    expect(result.current).toBe(false);
  });

  it("unsubscribes on unmount", () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const { unmount } = renderHook(() => useSignedIn());

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
