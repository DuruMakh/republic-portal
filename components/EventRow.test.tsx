import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventRow } from "./EventRow";
import type { PublicEventItem } from "@/lib/supabase/public";

// Georgian fixture values (title / description / location) spliced from
// lib/content-schemas.test.ts:41-44 -- never retyped.
const EVENT: PublicEventItem = {
  id: "e1",
  slug: "shekhvedra",
  title: "შეხვედრა",
  description: "აღწერა",
  location: "თბილისი, თავისუფლების მოედანი",
  starts_at: "2026-08-01T15:00:00Z",
  ends_at: null,
  status: "published",
  published_at: "2026-07-20T10:00:00Z",
};

describe("EventRow", () => {
  it("links to the event and shows title, location and time", () => {
    render(<EventRow event={EVENT} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/events/shekhvedra");
    expect(link).toHaveTextContent(EVENT.title);
    expect(link).toHaveTextContent(EVENT.location);
  });

  it("marks a cancelled event with a pill", () => {
    render(<EventRow event={{ ...EVENT, status: "cancelled" }} />);
    // Label spliced from contentPill("cancelled") in lib/admin.ts -- never retyped.
    expect(screen.getByRole("link")).toHaveTextContent("გაუქმებული");
  });
});
