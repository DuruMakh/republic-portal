import { describe, expect, it } from "vitest";
import {
  contentIdSchema,
  eventFormSchema,
  newsFormSchema,
  pollFormSchema,
  rsvpInputSchema,
  voteInputSchema,
} from "./content-schemas";

const UUID = "6f1b0a9e-0000-4000-8000-000000000001";

describe("newsFormSchema", () => {
  it("accepts a valid article (id optional)", () => {
    const r = newsFormSchema.safeParse({ title: "სათაური", body: "ტექსტი", visibility: "members" });
    expect(r.success).toBe(true);
  });
  it("trims and rejects empty/overlong title and body", () => {
    expect(newsFormSchema.safeParse({ title: "  ", body: "ბ", visibility: "public" }).success).toBe(
      false,
    );
    expect(
      newsFormSchema.safeParse({ title: "ა".repeat(161), body: "ბ", visibility: "public" }).success,
    ).toBe(false);
    expect(
      newsFormSchema.safeParse({ title: "ა", body: "ბ".repeat(20001), visibility: "public" })
        .success,
    ).toBe(false);
  });
  it("rejects unknown visibility and bad id", () => {
    expect(newsFormSchema.safeParse({ title: "ა", body: "ბ", visibility: "secret" }).success).toBe(
      false,
    );
    expect(
      newsFormSchema.safeParse({ id: "nope", title: "ა", body: "ბ", visibility: "public" }).success,
    ).toBe(false);
  });
});

describe("eventFormSchema", () => {
  const base = {
    title: "შეხვედრა",
    description: "აღწერა",
    location: "თბილისი, თავისუფლების მოედანი",
    startsAt: "2026-08-01T19:00",
  };
  it("accepts without endsAt and with empty endsAt", () => {
    expect(eventFormSchema.safeParse(base).success).toBe(true);
    expect(eventFormSchema.safeParse({ ...base, endsAt: "" }).success).toBe(true);
  });
  it("accepts a later endsAt, rejects equal/earlier", () => {
    expect(eventFormSchema.safeParse({ ...base, endsAt: "2026-08-01T21:00" }).success).toBe(true);
    expect(eventFormSchema.safeParse({ ...base, endsAt: "2026-08-01T19:00" }).success).toBe(false);
    expect(eventFormSchema.safeParse({ ...base, endsAt: "2026-08-01T18:00" }).success).toBe(false);
  });
  it("rejects malformed datetimes and overlong location", () => {
    expect(eventFormSchema.safeParse({ ...base, startsAt: "2026-08-01" }).success).toBe(false);
    expect(eventFormSchema.safeParse({ ...base, location: "ა".repeat(201) }).success).toBe(false);
  });
});

describe("pollFormSchema", () => {
  const base = { question: "პრიორიტეტი 2026?", options: ["დიახ", "არა"] };
  it("accepts 2–10 unique options; optional endsAt", () => {
    expect(pollFormSchema.safeParse(base).success).toBe(true);
    expect(pollFormSchema.safeParse({ ...base, endsAt: "2026-08-01T12:00" }).success).toBe(true);
    expect(pollFormSchema.safeParse({ ...base, endsAt: "" }).success).toBe(true);
  });
  it("rejects <2, >10, empty, overlong and duplicate options", () => {
    expect(pollFormSchema.safeParse({ ...base, options: ["ერთი"] }).success).toBe(false);
    expect(
      pollFormSchema.safeParse({ ...base, options: Array.from({ length: 11 }, (_, i) => `v${i}`) })
        .success,
    ).toBe(false);
    expect(pollFormSchema.safeParse({ ...base, options: ["ა", " "] }).success).toBe(false);
    expect(pollFormSchema.safeParse({ ...base, options: ["ა", "ბ".repeat(121)] }).success).toBe(
      false,
    );
    expect(pollFormSchema.safeParse({ ...base, options: ["იგივე", "იგივე "] }).success).toBe(false);
  });
  it("rejects an overlong question", () => {
    expect(pollFormSchema.safeParse({ ...base, question: "კ".repeat(301) }).success).toBe(false);
  });
});

describe("member input schemas", () => {
  it("rsvpInputSchema", () => {
    expect(rsvpInputSchema.safeParse({ eventId: UUID, going: true }).success).toBe(true);
    expect(rsvpInputSchema.safeParse({ eventId: "x", going: true }).success).toBe(false);
    expect(rsvpInputSchema.safeParse({ eventId: UUID, going: "yes" }).success).toBe(false);
  });
  it("voteInputSchema", () => {
    expect(voteInputSchema.safeParse({ pollId: UUID, optionId: UUID }).success).toBe(true);
    expect(voteInputSchema.safeParse({ pollId: UUID }).success).toBe(false);
  });
  it("contentIdSchema", () => {
    expect(contentIdSchema.safeParse({ id: UUID }).success).toBe(true);
    expect(contentIdSchema.safeParse({ id: 5 }).success).toBe(false);
  });
});
