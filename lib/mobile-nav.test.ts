import { describe, expect, it } from "vitest";
import { mobileBackTarget, mobileChrome, showsJoinCta, showsTabBar } from "./mobile-nav";

describe("mobileBackTarget", () => {
  it("maps a news article to the news index", () => {
    expect(mobileBackTarget("/news/regional-tour")).toEqual({
      href: "/news",
      label: "სიახლეები",
    });
  });
  it("maps an event detail to the events index", () => {
    expect(mobileBackTarget("/events/tbilisi-assembly")?.href).toBe("/events");
  });
  it("maps a delegate profile to the leaderboard", () => {
    expect(mobileBackTarget("/delegates/giorgi-khachidze")?.href).toBe("/leaderboard");
  });
  it("maps the membership wizard and its done screen to the profile", () => {
    expect(mobileBackTarget("/me/membership")?.href).toBe("/me/profile");
    expect(mobileBackTarget("/me/membership/done")?.href).toBe("/me/profile");
  });
  it("returns null for index routes, which are not detail screens", () => {
    expect(mobileBackTarget("/news")).toBeNull();
    expect(mobileBackTarget("/events")).toBeNull();
    expect(mobileBackTarget("/")).toBeNull();
  });
  it("returns null for a bare prefix with no slug", () => {
    expect(mobileBackTarget("/news/")).toBeNull();
  });
  it("does not confuse the public /delegates/ prefix with the /delegate cabinet", () => {
    expect(mobileBackTarget("/delegate")).toBeNull();
    expect(mobileBackTarget("/delegate/team")).toBeNull();
  });
});

describe("mobileChrome", () => {
  it("gives public routes the public header", () => {
    for (const p of ["/", "/leaderboard", "/news", "/events", "/transparency", "/support"]) {
      expect(mobileChrome(p), p).toBe("public");
    }
  });
  it("gives detail and flow routes the back header", () => {
    for (const p of ["/news/x", "/events/x", "/delegates/x", "/join", "/join/terms", "/login"]) {
      expect(mobileChrome(p), p).toBe("back");
    }
  });
  it("gives cabinet routes the cabinet header", () => {
    for (const p of ["/me", "/me/profile", "/me/polls", "/delegate", "/delegate/team"]) {
      expect(mobileChrome(p), p).toBe("cabinet");
    }
  });
  it("lets the back header win over the cabinet header in the membership wizard", () => {
    expect(mobileChrome("/me/membership")).toBe("back");
  });
});

describe("showsJoinCta", () => {
  it("shows on public and detail routes", () => {
    expect(showsJoinCta("/")).toBe(true);
    expect(showsJoinCta("/news/x")).toBe(true);
  });
  it("hides on the routes that are themselves the call to action", () => {
    expect(showsJoinCta("/join")).toBe(false);
    expect(showsJoinCta("/join/terms")).toBe(false);
    expect(showsJoinCta("/login")).toBe(false);
  });
});

describe("showsTabBar", () => {
  it("shows across the cabinet", () => {
    expect(showsTabBar("/me/profile")).toBe(true);
    expect(showsTabBar("/delegate")).toBe(true);
  });
  it("hides in the membership wizard, which must not offer five exits", () => {
    expect(showsTabBar("/me/membership")).toBe(false);
    expect(showsTabBar("/me/membership/done")).toBe(false);
  });
});
