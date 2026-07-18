import { describe, expect, it } from "vitest";
import {
  eventEndIso,
  formatEventTimeKa,
  isoToTbilisiLocal,
  percentages,
  pollView,
  rsvpOpen,
  splitEvents,
  tbilisiLocalToIso,
} from "./community";

const NOW = "2026-07-19T12:00:00.000Z";

function ev(starts_at: string, ends_at: string | null = null) {
  return { starts_at, ends_at };
}

describe("splitEvents (spec §3.2: past = coalesce(ends_at, starts_at) has passed)", () => {
  it("splits and orders: upcoming soonest-first, past most-recent-first", () => {
    const a = ev("2026-07-20T15:00:00.000Z"); // upcoming, sooner
    const b = ev("2026-08-01T15:00:00.000Z"); // upcoming, later
    const c = ev("2026-07-01T15:00:00.000Z"); // past, older
    const d = ev("2026-07-10T15:00:00.000Z"); // past, newer
    const { upcoming, past } = splitEvents([b, c, a, d], NOW);
    expect(upcoming).toEqual([a, b]);
    expect(past).toEqual([d, c]);
  });

  it("an event whose end instant is exactly now is still upcoming", () => {
    const edge = ev("2026-07-19T10:00:00.000Z", NOW);
    expect(splitEvents([edge], NOW).upcoming).toEqual([edge]);
  });

  it("a started event with a future end stays upcoming (ongoing)", () => {
    const ongoing = ev("2026-07-19T10:00:00.000Z", "2026-07-19T14:00:00.000Z");
    expect(splitEvents([ongoing], NOW).upcoming).toEqual([ongoing]);
  });

  it("eventEndIso falls back to starts_at", () => {
    expect(eventEndIso(ev("2026-07-01T00:00:00.000Z"))).toBe("2026-07-01T00:00:00.000Z");
    expect(eventEndIso(ev("a", "b"))).toBe("b");
  });
});

describe("rsvpOpen (decision #6/#7: toggle until start; cancelled locks)", () => {
  it("open for a published future event", () => {
    expect(rsvpOpen({ starts_at: "2026-07-20T15:00:00.000Z", status: "published" }, NOW)).toBe(
      true,
    );
  });
  it("closed at the exact start instant and after", () => {
    expect(rsvpOpen({ starts_at: NOW, status: "published" }, NOW)).toBe(false);
    expect(rsvpOpen({ starts_at: "2026-07-19T00:00:00.000Z", status: "published" }, NOW)).toBe(
      false,
    );
  });
  it("closed for cancelled events regardless of time", () => {
    expect(rsvpOpen({ starts_at: "2026-07-20T15:00:00.000Z", status: "cancelled" }, NOW)).toBe(
      false,
    );
  });
});

describe("pollView (decision #4)", () => {
  it("open + not voted → buttons", () => expect(pollView("open", false)).toBe("buttons"));
  it("open + voted → results-own", () => expect(pollView("open", true)).toBe("results-own"));
  it("closed → results for everyone", () => {
    expect(pollView("closed", false)).toBe("results-closed");
    expect(pollView("closed", true)).toBe("results-closed");
  });
});

describe("percentages (largest remainder, sums to 100)", () => {
  it("thirds round deterministically", () => {
    expect(percentages([1, 1, 1])).toEqual([34, 33, 33]);
  });
  it("typical splits", () => {
    expect(percentages([2, 1])).toEqual([67, 33]);
    expect(percentages([71, 14, 15])).toEqual([71, 14, 15]);
  });
  it("zero votes → all zeros (no NaN)", () => {
    expect(percentages([0, 0, 0])).toEqual([0, 0, 0]);
  });
  it("empty array → empty", () => {
    expect(percentages([])).toEqual([]);
  });
});

describe("Tbilisi datetime-local bridge (ADR-016: UTC+4, no DST)", () => {
  it("wall time → ISO UTC (−4h)", () => {
    expect(tbilisiLocalToIso("2026-07-25T19:00")).toBe("2026-07-25T15:00:00.000Z");
  });
  it("round-trips through isoToTbilisiLocal", () => {
    expect(isoToTbilisiLocal("2026-07-25T15:00:00.000Z")).toBe("2026-07-25T19:00");
  });
  it("crosses date lines correctly (00:30 Tbilisi = 20:30 UTC prior day)", () => {
    expect(tbilisiLocalToIso("2026-07-25T00:30")).toBe("2026-07-24T20:30:00.000Z");
    expect(isoToTbilisiLocal("2026-07-24T20:30:00.000Z")).toBe("2026-07-25T00:30");
  });
  it("rejects malformed input", () => {
    expect(tbilisiLocalToIso("2026-07-25")).toBeNull();
    expect(tbilisiLocalToIso("garbage")).toBeNull();
    expect(isoToTbilisiLocal("garbage")).toBe("");
  });
});

describe("formatEventTimeKa", () => {
  it("start only", () => {
    expect(formatEventTimeKa("2026-07-25T15:00:00.000Z", null)).toBe("25.07.2026, 19:00");
  });
  it("same-day range uses an en-dash", () => {
    expect(formatEventTimeKa("2026-07-25T15:00:00.000Z", "2026-07-25T17:00:00.000Z")).toBe(
      "25.07.2026, 19:00–21:00",
    );
  });
  it("cross-day range repeats the date", () => {
    expect(formatEventTimeKa("2026-07-25T15:00:00.000Z", "2026-07-26T07:00:00.000Z")).toBe(
      "25.07.2026, 19:00 — 26.07.2026, 11:00",
    );
  });
});
