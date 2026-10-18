import { describe, expect, it } from "vitest";
import {
  eventDateBadge,
  eventDayMonth,
  formatDate,
  formatEventTime,
  formatMemberSince,
} from "./format";

describe("localized public dates", () => {
  it("keeps Georgian formatting and reads English dates in Tbilisi time", () => {
    expect(formatDate("2026-10-17T21:30:00Z", "ka")).toBe("18.10.2026");
    expect(formatDate("2026-10-17T21:30:00Z", "en")).toBe("18 October 2026");
  });

  it("keeps event end dates when an event crosses local midnight", () => {
    expect(formatEventTime("2026-10-17T19:30:00Z", "2026-10-17T21:00:00Z", "en")).toBe(
      "17 October 2026, 23:30 — 18 October 2026, 01:00",
    );
    expect(eventDateBadge("2026-10-17T21:00:00Z", "en")).toEqual({
      day: "18",
      monthYear: "October 2026",
    });
  });

  it("formats account month labels without changing the Georgian wording", () => {
    expect(formatMemberSince("2026-09-30T21:00:00Z", "en")).toBe("October 2026");
    expect(formatMemberSince("2026-09-30T21:00:00Z", "ka")).toBe("2026 წლის ოქტომბრიდან");
    expect(formatMemberSince(null, "en")).toBeNull();
    expect(formatMemberSince("invalid", "en")).toBeNull();
    expect(eventDayMonth("2026-09-30T21:00:00Z", "en")).toEqual({ day: "01", month: "Oct" });
  });
});
