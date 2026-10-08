import { describe, expect, it } from "vitest";
import { hiddenBySwitch } from "./hidden-routes";

const ALL_HIDDEN = { financesPublic: false, eventsShown: false };
const ALL_SHOWN = { financesPublic: true, eventsShown: true };

describe("hiddenBySwitch", () => {
  it.each(["/transparency", "/transparency/", "/events", "/events/", "/events/any-event-slug"])(
    "hides %s while its switch is off",
    (pathname) => {
      expect(hiddenBySwitch(pathname, ALL_HIDDEN)).toBe(true);
    },
  );

  it.each(["/transparency", "/events", "/events/any-event-slug"])(
    "leaves %s alone while its switch is on",
    (pathname) => {
      expect(hiddenBySwitch(pathname, ALL_SHOWN)).toBe(false);
    },
  );

  it("follows each switch on its own", () => {
    const financesOnly = { financesPublic: true, eventsShown: false };
    expect(hiddenBySwitch("/transparency", financesOnly)).toBe(false);
    expect(hiddenBySwitch("/events", financesOnly)).toBe(true);
    const eventsOnly = { financesPublic: false, eventsShown: true };
    expect(hiddenBySwitch("/transparency", eventsOnly)).toBe(true);
    expect(hiddenBySwitch("/events/any-event-slug", eventsOnly)).toBe(false);
  });

  it.each([
    "/",
    "/news",
    "/eventsx",
    "/transparency-report",
    "/me/events",
    "/admin/content/events",
  ])(
    "never hides %s: other pages, and the cabinet and admin pages that render per request",
    (pathname) => {
      expect(hiddenBySwitch(pathname, ALL_HIDDEN)).toBe(false);
    },
  );
});
