import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({ fetchPublicEvents: vi.fn() }));
vi.mock("@/lib/supabase/public", () => data);
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { NOT_FOUND_METADATA } from "@/components/NotFoundNotice";
import EventsPage, { generateMetadata } from "./page";

beforeEach(() => {
  // Hidden is the default: pin it, so a SHOW_EVENTS exported in the caller's shell cannot flip
  // these tests. The shown-mode test below stubs it to "true" itself.
  vi.stubEnv("SHOW_EVENTS", undefined);
  data.fetchPublicEvents.mockReset();
  data.fetchPublicEvents.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/events while events are hidden (the default, ADR-042)", () => {
  it("answers not-found and never reads the events", async () => {
    await expect(EventsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(data.fetchPublicEvents).not.toHaveBeenCalled();
  });

  it("presents as a generic not-found, never with its own title", () => {
    const metadata = generateMetadata();
    expect(metadata).toEqual(NOT_FOUND_METADATA);
    expect(JSON.stringify(metadata)).not.toContain("ღონისძიებ");
  });
});

describe("/events once SHOW_EVENTS=true", () => {
  it("renders the list again under its own title", async () => {
    vi.stubEnv("SHOW_EVENTS", "true");

    render(await EventsPage());

    expect(screen.getByRole("heading", { level: 1, name: "ღონისძიებები" })).toBeInTheDocument();
    expect(String(generateMetadata().title)).toContain("ღონისძიებები");
  });
});
