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
const hasGeo = new RegExp("[" + GEO + "]", "u");
const georgian = new RegExp("[" + GEO + "]", "u");
// We flag only LETTERS from other scripts, not every non-Georgian character.
// The threat is a homoglyph -- a Latin "o", Cyrillic "о" or Greek
// "ο" fused into a Georgian word, indistinguishable on screen. Digits,
// punctuation and symbols (the footer's "©", an em dash) cannot be
// mistaken for a Georgian letter, so an allowlist of permitted punctuation
// would only grow forever and produce false alarms on legitimate copy.
const isLetter = /\p{L}/u;

let failures = 0;
for (const file of process.argv.slice(2)) {
  const source = readFileSync(file, "utf8");
  const literals = source.match(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g) ?? [];
  for (const raw of literals) {
    // We read raw source, so normalise away two things that are not text.
    // First ${...}: the identifier inside a template literal is Latin by
    // definition and says nothing about the Georgian around it. Then escape
    // sequences: in source, "ორი\nხაზი" carries a literal backslash and "n"
    // sitting right against a Georgian letter, which is not a homoglyph.
    const value = raw
      .slice(1, -1)
      .replace(/\$\{[^}]*\}/g, " ")
      .replace(/\\u\{[0-9a-fA-F]+\}|\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}|\\./g, " ");
    if (!hasGeo.test(value)) continue;
    // Flag a foreign letter only where it TOUCHES a Georgian one. That is what
    // corruption looks like: a homoglyph fused into a word ("მoგვწერე"). A
    // deliberate Latin token standing beside Georgian -- "super_admin-ის",
    // "GR-კოდი", "5XX XX XX XX" -- never touches a Georgian letter directly,
    // and flagging those would bury the real signal in noise.
    const chars = [...value];
    const foreign = (i) => {
      const ch = chars[i];
      return ch !== undefined && isLetter.test(ch) && !georgian.test(ch);
    };
    const geo = (i) => {
      const ch = chars[i];
      return ch !== undefined && georgian.test(ch);
    };
    const offenders = [
      ...new Set(chars.filter((_, i) => foreign(i) && (geo(i - 1) || geo(i + 1)))),
    ];
    if (offenders.length === 0) continue;
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
