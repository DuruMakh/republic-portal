import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSignedIn } from "./useSignedIn";

type TestSession = { user: { id: string } } | null;
type AuthListener = (event: string, session: TestSession) => void;

const { getSession, onAuthStateChange, unsubscribe, signedInStateWrites } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
  signedInStateWrites: [] as unknown[],
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: <State,>(initial: State) => {
      const [state, setState] = actual.useState(initial);
      if (!Object.is(initial, false)) return [state, setState] as const;
      const trackedSetState: typeof setState = (next) => {
        signedInStateWrites.push(next);
        setState(next);
      };
      return [state, trackedSetState] as const;
    },
  };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession, onAuthStateChange } }),
}));

function deferredSession() {
  let resolve!: (value: { data: { session: TestSession } }) => void;
  const promise = new Promise<{ data: { session: TestSession } }>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("useSignedIn", () => {
  beforeEach(() => {
    getSession.mockReset();
    onAuthStateChange.mockReset();
    unsubscribe.mockReset();
    signedInStateWrites.length = 0;
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

  it("ignores an initial session that resolves after unmount", async () => {
    const pending = deferredSession();
    getSession.mockReturnValue(pending.promise);
    const observed: boolean[] = [];
    const { unmount } = renderHook(() => {
      const signedIn = useSignedIn();
      observed.push(signedIn);
      return signedIn;
    });
    unmount();

    await act(async () => {
      pending.resolve({ data: { session: { user: { id: "late" } } } });
      await pending.promise;
    });

    expect(observed).toEqual([false]);
    expect(signedInStateWrites).toEqual([]);
  });
});
