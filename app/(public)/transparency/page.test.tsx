import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  fetchTransparencyStats: vi.fn(),
  fetchTransparencyRegions: vi.fn(),
  fetchPublicStats: vi.fn(),
}));
vi.mock("@/lib/supabase/public", () => data);
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { NOT_FOUND_METADATA } from "@/components/NotFoundNotice";
import TransparencyPage, { generateMetadata } from "./page";

beforeEach(() => {
  // Hidden is the default: pin it, so a SHOW_PUBLIC_FINANCES exported in the caller's shell cannot
  // flip these tests. The public-mode tests below stub it to "true" themselves.
  vi.stubEnv("SHOW_PUBLIC_FINANCES", undefined);
  data.fetchTransparencyStats.mockReset();
  data.fetchTransparencyRegions.mockReset();
  data.fetchPublicStats.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/transparency while finances are hidden (the default)", () => {
  it("answers not-found and never touches the finance data", async () => {
    await expect(TransparencyPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(data.fetchTransparencyStats).not.toHaveBeenCalled();
    expect(data.fetchTransparencyRegions).not.toHaveBeenCalled();
    expect(data.fetchPublicStats).not.toHaveBeenCalled();
  });

  it("presents as a generic not-found, so even the 404 cannot name the finance page", () => {
    // A static metadata export is still streamed inside the 404's page data and can end up as the
    // browser tab title, so while hidden the page's metadata must be the generic Georgian
    // not-found title and never its own.
    const metadata = generateMetadata();
    expect(metadata).toEqual(NOT_FOUND_METADATA);
    expect(JSON.stringify(metadata)).not.toContain("გამჭვირვალობა");
  });
});

describe("/transparency once finances are public (SHOW_PUBLIC_FINANCES=true)", () => {
  it("renders the page again", async () => {
    vi.stubEnv("SHOW_PUBLIC_FINANCES", "true");
    data.fetchTransparencyStats.mockResolvedValue({
      total_gel: 1234,
      registered_members: 5,
      approved_delegates: 2,
    });
    data.fetchTransparencyRegions.mockResolvedValue([]);
    data.fetchPublicStats.mockResolvedValue({
      approved_delegates: 2,
      active_members: 3,
      registered_total: 9,
    });

    render(await TransparencyPage());

    expect(screen.getByRole("heading", { name: "გამჭვირვალობა" })).toBeInTheDocument();
  });
});
