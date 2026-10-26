import { describe, expect, it } from "vitest";
import { getExampleNumber, type CountryCode } from "libphonenumber-js/mobile";
import examples from "libphonenumber-js/mobile/examples";
import { FOREIGN_SMS_COUNTRIES, parseRegistrationPhone } from "./phone-number";

// Example numbers come from libphonenumber-js's own metadata, so they are valid mobiles by definition.
function example(country: CountryCode): string {
  const number = getExampleNumber(country, examples);
  if (!number) throw new Error(`no example mobile for ${country}`);
  return number.number;
}

describe("parseRegistrationPhone", () => {
  it("keeps every Georgian form working", () => {
    for (const v of ["555 12 34 56", "995555123456", "+995 555 12 34 56"]) {
      expect(parseRegistrationPhone(v)).toEqual({
        ok: true,
        phone: "+995555123456",
        country: "GE",
        region: "georgia",
      });
    }
  });

  it("accepts an allowed foreign mobile with its country code", () => {
    expect(parseRegistrationPhone("+31 6 54798014")).toEqual({
      ok: true,
      phone: "+31654798014",
      country: "NL",
      region: "foreign",
    });
    expect(parseRegistrationPhone(example("US"))).toMatchObject({
      ok: true,
      country: "US",
      region: "foreign",
    });
  });

  it("refuses countries off the list", () => {
    expect(parseRegistrationPhone(example("RU"))).toEqual({
      ok: false,
      reason: "country_not_supported",
    });
    // +1 like the US and Canada, but a different country
    expect(parseRegistrationPhone(example("JM"))).toEqual({
      ok: false,
      reason: "country_not_supported",
    });
  });

  it("refuses junk, landlines and numbers without a country code", () => {
    for (const v of ["", "abc", "+995 32 212 34 56", "31654798014", "+31 20 123 4567"]) {
      expect(parseRegistrationPhone(v)).toEqual({ ok: false, reason: "invalid" });
    }
  });
});

describe("FOREIGN_SMS_COUNTRIES", () => {
  it("is the owner-approved list: EU, EEA, GB, CH, US, CA, IL, TR, UA, and not Russia", () => {
    const eu = "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE";
    const expected = [...eu.split(" "), "IS", "LI", "NO", "GB", "CH", "US", "CA", "IL", "TR", "UA"];
    expect([...FOREIGN_SMS_COUNTRIES].sort()).toEqual(expected.sort());
    expect(FOREIGN_SMS_COUNTRIES.has("RU")).toBe(false);
    expect(FOREIGN_SMS_COUNTRIES.has("GE")).toBe(false);
  });
});
