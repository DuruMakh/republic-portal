import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCountKa } from "@/lib/format";

const data = vi.hoisted(() => ({
  fetchPublicStats: vi.fn(),
  fetchPublicDelegates: vi.fn(),
  fetchTransparencyStats: vi.fn(),
  fetchPublicNews: vi.fn(),
  fetchPublicEvents: vi.fn(),
}));
vi.mock("@/lib/supabase/public", () => data);

import HomePage from "./page";

const DUES_LABEL = "შეგროვებული საწევრო შენატანები";

// formatCountKa groups digits with a no-break space, which Testing Library's text matcher
// normalizes to a plain space before comparing — so the expectation must be normalized the
// same way, or a "not shown" assertion would pass vacuously.
const DUES_FIGURE = `${formatCountKa(24840)}₾`.replace(/\s+/g, " ");

beforeEach(() => {
  // Hidden is the default: pin it, so a SHOW_PUBLIC_FINANCES exported in the caller's shell cannot
  // flip these tests. The public-mode test below stubs it to "true" itself.
  vi.stubEnv("SHOW_PUBLIC_FINANCES", undefined);
  for (const fetcher of Object.values(data)) fetcher.mockReset();
  data.fetchPublicStats.mockResolvedValue({
    approved_delegates: 12,
    active_members: 1636,
    registered_total: 1906,
  });
  data.fetchPublicDelegates.mockResolvedValue([]);
  data.fetchPublicNews.mockResolvedValue([]);
  data.fetchPublicEvents.mockResolvedValue([]);
  data.fetchTransparencyStats.mockResolvedValue({
    total_gel: 24840,
    registered_members: 1774,
    approved_delegates: 12,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("homepage counters while finances are hidden (the default)", () => {
  it("omits the collected-dues figure and never fetches the finance totals", async () => {
    render(await HomePage());

    expect(screen.queryByText(DUES_LABEL)).not.toBeInTheDocument();
    expect(screen.queryByText(DUES_FIGURE)).not.toBeInTheDocument();
    expect(data.fetchTransparencyStats).not.toHaveBeenCalled();
  });

  it("still shows the three membership counters", async () => {
    render(await HomePage());

    expect(screen.getByTestId("stat-approved-delegates")).toBeInTheDocument();
    expect(screen.getByTestId("stat-active-members")).toBeInTheDocument();
    expect(screen.getByTestId("stat-registered-total")).toBeInTheDocument();
  });
});

describe("homepage counters once finances are public (SHOW_PUBLIC_FINANCES=true)", () => {
  it("shows the collected-dues figure again", async () => {
    vi.stubEnv("SHOW_PUBLIC_FINANCES", "true");

    render(await HomePage());

    expect(screen.getByText(DUES_LABEL)).toBeInTheDocument();
    expect(screen.getByText(DUES_FIGURE)).toBeInTheDocument();
    expect(data.fetchTransparencyStats).toHaveBeenCalledTimes(1);
  });
});
