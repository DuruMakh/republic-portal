import { describe, expect, it } from "vitest";
import {
  mobileBackTarget,
  mobileChrome,
  mobileTabs,
  showsJoinCta,
  showsTabBar,
} from "./mobile-nav";
import { cabinetNavItems } from "./cabinet";

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
    expect(mobileChrome("/me/membership/done")).toBe("back");
  });
  it("falls back to public chrome for an unclassified route", () => {
    expect(mobileChrome("/some-unmapped-route")).toBe("public");
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

describe("mobileTabs", () => {
  it("gives a registered member four tabs and no overflow destinations", () => {
    const { tabs, more } = mobileTabs(cabinetNavItems("registered"), "registered");
    expect(tabs.map((t) => t.href)).toEqual(["/me", "/me/events", "/me/news", "/me/profile"]);
    expect(more).toEqual([]);
  });

  it("gives a member four tabs and pushes delegate and billing to the sheet", () => {
    const { tabs, more } = mobileTabs(cabinetNavItems("member"), "member");
    expect(tabs.map((t) => t.href)).toEqual(["/me/profile", "/me/polls", "/me/events", "/me/news"]);
    expect(more.map((m) => m.href)).toEqual(["/me/delegate", "/me/billing"]);
  });

  it("leads the delegate bar with the panel, which is where login already sends them", () => {
    const { tabs, more } = mobileTabs(cabinetNavItems("delegate"), "delegate");
    expect(tabs[0]?.href).toBe("/delegate");
    expect(tabs.map((t) => t.href)).toEqual(["/delegate", "/me/polls", "/me/events", "/me/news"]);
    expect(more.map((m) => m.href)).toEqual(["/me/profile", "/me/billing"]);
  });

  it("shortens only the labels that cannot fit a fifth of a 360px screen", () => {
    const { tabs } = mobileTabs(cabinetNavItems("member"), "member");
    const label = (href: string) => tabs.find((t) => t.href === href)?.label;
    expect(label("/me/polls")).toBe("გამოკითხვა");
    expect(label("/me/events")).toBe("ღონისძიება");
    expect(label("/me/news")).toBe("სიახლე");
    expect(label("/me/profile")).toBe("პროფილი");
  });

  it("shortens the delegate panel label too — the full one is sixteen characters", () => {
    const { tabs } = mobileTabs(cabinetNavItems("delegate"), "delegate");
    expect(tabs[0]?.label).toBe("პანელი");
  });

  it("keeps every tab label at or under ten characters", () => {
    for (const role of ["registered", "member", "delegate"] as const) {
      for (const tab of mobileTabs(cabinetNavItems(role), role).tabs) {
        expect(tab.label.length, `${role} ${tab.href}`).toBeLessThanOrEqual(10);
      }
    }
  });

  it("carries the open-polls count through onto the tab", () => {
    const items = cabinetNavItems("member").map((i) =>
      i.href === "/me/polls" ? { ...i, count: 3 } : i,
    );
    const { tabs } = mobileTabs(items, "member");
    expect(tabs.find((t) => t.href === "/me/polls")?.count).toBe(3);
  });

  it("always sends the admin entry to the sheet, never the bar", () => {
    const { tabs, more } = mobileTabs(cabinetNavItems("member", true), "member");
    expect(tabs.some((t) => t.href === "/admin")).toBe(false);
    expect(more.map((m) => m.href)).toContain("/admin");
  });

  it("is unaffected by the order cabinetNavItems returns", () => {
    const shuffled = [...cabinetNavItems("member")].reverse();
    const { tabs } = mobileTabs(shuffled, "member");
    expect(tabs.map((t) => t.href)).toEqual(["/me/profile", "/me/polls", "/me/events", "/me/news"]);
  });

  it("drops a tab rather than throwing when an expected href is absent", () => {
    const withoutPolls = cabinetNavItems("member").filter((i) => i.href !== "/me/polls");
    const { tabs } = mobileTabs(withoutPolls, "member");
    expect(tabs.map((t) => t.href)).toEqual(["/me/profile", "/me/events", "/me/news"]);
  });
});
