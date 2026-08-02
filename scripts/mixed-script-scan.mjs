// Usage: node scripts/mixed-script-scan.mjs <file> [...files]
//
// The backstop DESIGN.md:179 calls for and ka-gate deliberately omits: a lone
// Latin or Cyrillic letter fused inside a Georgian word (a Latin "o" inside
// a Georgian word renders identically) passes every ka-gate check and would
// ship. This asserts that any string literal containing Georgian contains ONLY
// Georgian, digits, and the punctuation our copy uses.
//
// Every pattern is built from \uXXXX escapes, never literal glyphs, so this
// file stays ASCII-clean and cannot itself be silently normalized -- the same
// discipline scripts/ka-gate.mjs uses.
import { readFileSync } from "node:fs";

const GEO = "\\u10A0-\\u10FF\\u1C90-\\u1CBF\\u2D00-\\u2D2F";
// space . , ( ) - : ! ? the em dash, ASCII digits, and the Georgian paragraph
// separator U+00B7 is deliberately NOT included -- add only what copy needs.
const PUNCT =
  "\\u0020\\u002E\\u002C\\u0028\\u0029\\u002D\\u003A\\u0021\\u003F\\u2014\\u0030-\\u0039";
const hasGeo = new RegExp("[" + GEO + "]", "u");
const pure = new RegExp("^[" + GEO + PUNCT + "]+$", "u");
const allowedChar = new RegExp("[" + GEO + PUNCT + "]", "u");

let failures = 0;
for (const file of process.argv.slice(2)) {
  const source = readFileSync(file, "utf8");
  const literals = source.match(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g) ?? [];
  for (const raw of literals) {
    const value = raw.slice(1, -1);
    if (!hasGeo.test(value) || pure.test(value)) continue;
    const offenders = [...new Set([...value].filter((ch) => !allowedChar.test(ch)))];
    console.log(
      "MIXED-SCRIPT " +
        file +
        "  " +
        raw +
        "  offending: " +
        offenders
          .map((ch) => "U+" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"))
          .join(" "),
    );
    failures++;
  }
}
console.log("mixed-script scan: " + (failures === 0 ? "clean" : failures + " impure literal(s)"));
process.exit(failures === 0 ? 0 : 1);
