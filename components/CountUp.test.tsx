import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatCountKa } from "@/lib/format";
import { CountUp } from "./CountUp";

describe("CountUp", () => {
  it("server-renders the final formatted value (no zero flash)", () => {
    render(<CountUp value={1636} />);
    expect(screen.getByText(formatCountKa(1636))).toBeInTheDocument();
  });
});
