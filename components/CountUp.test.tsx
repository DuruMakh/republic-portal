import { getDefaultNormalizer, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCountKa } from "@/lib/format";
import { CountUp } from "./CountUp";

function setPrefersReducedMotion(value: boolean) {
  (
    globalThis as unknown as { __setPrefersReducedMotion: (value: boolean) => void }
  ).__setPrefersReducedMotion(value);
}

describe("CountUp", () => {
  it("server-renders the final formatted value (no zero flash)", () => {
    render(<CountUp value={1636} />);
    // The default normalizer collapses whitespace (including NBSP) to a
    // plain space, which would mask the exact separator formatCountKa
    // renders. Disable whitespace collapsing so this compares the literal
    // NBSP-grouped string, since that byte-for-byte match is what SSR/client
    // hydration parity actually depends on.
    expect(
      screen.getByText(formatCountKa(1636), {
        normalizer: getDefaultNormalizer({ collapseWhitespace: false }),
      }),
    ).toBeInTheDocument();
  });

  describe("when motion is not reduced", () => {
    afterEach(() => {
      // Always restore real timers, even if an assertion above throws, so a
      // failure here can't leak fake timers into later tests.
      vi.useRealTimers();
    });

    it("animates 0 -> value via requestAnimationFrame, then cancels cleanly on unmount", () => {
      setPrefersReducedMotion(false);
      vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] });

      const { unmount, container } = render(<CountUp value={100} />);
      const span = container.querySelector("span");
      if (!span) throw new Error("expected CountUp to render a span");

      // The SSR markup already contains the final formatted value, so reaching
      // "100" alone would pass even if the tick path never ran. Advance only a
      // little way into the 1100ms duration first and require a partial,
      // strictly-less-than-final value — that only happens if requestAnimationFrame
      // actually drove the DOM update.
      vi.advanceTimersByTime(100);
      const mid = Number(span.textContent);
      expect(mid).toBeGreaterThanOrEqual(0);
      expect(mid).toBeLessThan(100);

      // Drain the remaining rAF loop to its settled final frame.
      vi.advanceTimersByTime(2000);
      expect(screen.getByText(formatCountKa(100))).toBeInTheDocument();

      // Unmounting must run the effect cleanup (cancelAnimationFrame). If it
      // didn't, a stray rAF callback firing after unmount would throw trying
      // to write to a detached node's textContent.
      unmount();
      expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
    });
  });
});
