import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installMatchMedia } from "./test-utils/matchMedia";
import { useCloseAboveMd } from "./useCloseAboveMd";

const MD_QUERY = "(min-width: 48rem)";
const installed: Array<ReturnType<typeof installMatchMedia>> = [];

afterEach(() => {
  installed.pop()?.restore();
});

describe("useCloseAboveMd", () => {
  it("closes when Tailwind's 48rem md query crosses to matching", () => {
    const media = installMatchMedia();
    installed.push(media);
    const close = vi.fn();
    renderHook(() => useCloseAboveMd(close));

    expect(media.queries()).toEqual([MD_QUERY]);
    act(() => media.emit(MD_QUERY, true));

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("removes its change listener on unmount", () => {
    const media = installMatchMedia();
    installed.push(media);
    const { unmount } = renderHook(() => useCloseAboveMd(vi.fn()));
    expect(media.listenerCount(MD_QUERY)).toBe(1);

    unmount();

    expect(media.listenerCount(MD_QUERY)).toBe(0);
  });
});
