import { getDefaultNormalizer, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatCountKa } from "@/lib/format";
import { CountUp } from "./CountUp";

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
});
