/**
 * Georgian capitals (Mtavruli) for the „ერთობა“ labels, buttons and menus. CSS `uppercase` leaves
 * Georgian unchanged in browsers, while the Unicode case mapping JavaScript uses turns
 * მხედრული letters into their Mtavruli capitals (ა → Ა). Other characters pass through.
 */
export function mtavruli(text: string): string {
  return text.toUpperCase();
}
