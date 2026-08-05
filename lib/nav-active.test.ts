import { describe, expect, it } from "vitest";
import { activeNavHref } from "./nav-active";

const REGISTERED = [
  { href: "/me" },
  { href: "/me/events" },
  { href: "/me/news" },
  { href: "/me/profile" },
];

describe("activeNavHref", () => {
  it("marks exactly the deepest match, never the /me root as well", () => {
    expect(activeNavHref(REGISTERED, "/me/events")).toBe("/me/events");
    expect(activeNavHref(REGISTERED, "/me/profile")).toBe("/me/profile");
  });
  it("marks the root on the root itself", () => {
    expect(activeNavHref(REGISTERED, "/me")).toBe("/me");
  });
  it("falls back to the root on a subroute no other item claims", () => {
    expect(activeNavHref(REGISTERED, "/me/membership")).toBe("/me");
  });
  it("returns null when nothing matches", () => {
    expect(activeNavHref(REGISTERED, "/news")).toBeNull();
  });
});
