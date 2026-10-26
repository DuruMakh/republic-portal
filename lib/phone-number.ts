import { parsePhoneNumberFromString } from "libphonenumber-js/mobile";
import { normalizeGeorgianPhone } from "./validation";

export type PhoneRegion = "georgia" | "foreign";

export type ParsedRegistrationPhone =
  | { ok: true; phone: string; country: string; region: PhoneRegion }
  | { ok: false; reason: "invalid" | "country_not_supported" };

const EU = "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split(
  " ",
);

/**
 * Countries whose mobiles may get a registration code by SMS from abroad (owner, 2026-10-25):
 * EU, the rest of the EEA, the UK, Switzerland, the US, Canada, Israel, Turkey and Ukraine.
 * Russia is deliberately absent. Twilio's Verify geo-permissions mirror this list.
 */
export const FOREIGN_SMS_COUNTRIES: ReadonlySet<string> = new Set([
  ...EU,
  "IS",
  "LI",
  "NO",
  "GB",
  "CH",
  "US",
  "CA",
  "IL",
  "TR",
  "UA",
]);

/**
 * A number typed at registration → E.164 plus where it belongs. Georgian mobiles keep every
 * form they had (local, 995…, +995…); a foreign one needs its "+country code". The country
 * comes from the numbering plan, not the prefix: +1 and +44 also cover territories off the list.
 */
export function parseRegistrationPhone(value: string): ParsedRegistrationPhone {
  const georgian = normalizeGeorgianPhone(value);
  if (georgian !== null) return { ok: true, phone: georgian, country: "GE", region: "georgia" };

  const trimmed = value.trim();
  if (!trimmed.startsWith("+")) return { ok: false, reason: "invalid" };
  const parsed = parsePhoneNumberFromString(trimmed);
  if (!parsed?.isValid() || !parsed.country || parsed.country === "GE") {
    return { ok: false, reason: "invalid" };
  }
  if (!FOREIGN_SMS_COUNTRIES.has(parsed.country)) {
    return { ok: false, reason: "country_not_supported" };
  }
  return { ok: true, phone: parsed.number, country: parsed.country, region: "foreign" };
}
