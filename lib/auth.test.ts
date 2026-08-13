import { describe, expect, it } from "vitest";
import { safeAuthNext } from "./auth";

describe("safeAuthNext", () => {
  it.each([
    ["/join?ref=D00101", "/join?ref=D00101"],
    ["/me", "/me"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/join\\evil", "/"],
    ["/join%5Cevil", "/"],
    ["/join\u0000evil", "/"],
    [null, "/"],
  ])("maps %j to %j", (input, expected) => {
    expect(safeAuthNext(input)).toBe(expected);
  });
});
