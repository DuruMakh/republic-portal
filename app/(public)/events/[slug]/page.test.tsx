import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  fetchPublicEvents: vi.fn(),
  fetchPublicEventBySlug: vi.fn(),
}));
vi.mock("@/lib/supabase/public", () => data);
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { NOT_FOUND_METADATA } from "@/components/NotFoundNotice";
import EventPage, { generateMetadata, generateStaticParams } from "./page";

const params = Promise.resolve({ slug: "tbilisi-meeting" });

beforeEach(() => {
  vi.stubEnv("SHOW_EVENTS", undefined);
  data.fetchPublicEvents.mockReset();
  data.fetchPublicEventBySlug.mockReset();
  data.fetchPublicEvents.mockResolvedValue([{ slug: "tbilisi-meeting" }]);
  data.fetchPublicEventBySlug.mockResolvedValue({
    id: "e-1",
    slug: "tbilisi-meeting",
    title: "შეხვედრა თბილისში",
    description: "აღწერა",
    location: "თბილისი",
    starts_at: "2030-01-01T10:00:00Z",
    ends_at: null,
    status: "published",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/events/[slug] while events are hidden (the default, ADR-038)", () => {
  it("answers not-found, even for a real event's address, without reading it", async () => {
    await expect(EventPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(data.fetchPublicEventBySlug).not.toHaveBeenCalled();
  });

  it("builds no event pages ahead of time", async () => {
    expect(await generateStaticParams()).toEqual([]);
    expect(data.fetchPublicEvents).not.toHaveBeenCalled();
  });

  it("presents as a generic not-found, never with the event's title", async () => {
    const metadata = await generateMetadata({ params });
    expect(metadata).toEqual(NOT_FOUND_METADATA);
    expect(data.fetchPublicEventBySlug).not.toHaveBeenCalled();
  });
});

describe("/events/[slug] once SHOW_EVENTS=true", () => {
  it("builds and titles the event page again", async () => {
    vi.stubEnv("SHOW_EVENTS", "true");

    expect(await generateStaticParams()).toEqual([{ slug: "tbilisi-meeting" }]);
    expect(String((await generateMetadata({ params })).title)).toContain("შეხვედრა თბილისში");
  });
});
