// Usage:
//   node scripts/mixed-script-scan.mjs <file> [...files]
//   npm run ka:scan          (every tracked .ts/.tsx)
//
// The backstop DESIGN.md calls for and ka-gate deliberately omits: a foreign
// letter fused inside a Georgian word. Latin U+006F, Cyrillic U+043E and Greek
// U+03BF all render indistinguishably from Georgian text around them, pass
// every ka-gate check, and ship.
//
// This file names those characters by CODEPOINT and never writes them as
// glyphs. An earlier revision spelled them out in this very comment, which
// made ka-gate fail on the scanner itself ("greek look-alike") and made the
// scanner report its own source as corrupt -- a gate that cannot be pointed at
// its own repository is one nobody will wire up.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * With no arguments, scan every tracked source file. Resolved here rather than
 * with a shell glob in package.json so `npm run ka:scan` behaves the same on
 * the owner's Windows shell as in CI.
 */
function targets() {
  const args = process.argv.slice(2);
  if (args.length > 0) return args;
  return execFileSync("git", ["ls-files", "*.ts", "*.tsx", "*.mjs"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

const GEO = "\\u10A0-\\u10FF\\u1C90-\\u1CBF\\u2D00-\\u2D2F";
const georgian = new RegExp("[" + GEO + "]", "u");
const isLetter = /\p{L}/u;

/**
 * Georgian-bearing spans worth checking. Quoted literals AND JSX text, because
 * most user-facing Georgian in this repo is a bare JSX child (`<h1>ტექსტი</h1>`),
 * which a literals-only scan never sees.
 */
function spans(source) {
  const literals = source.match(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g) ?? [];
  const jsxText = [...source.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]);
  return [...literals, ...jsxText];
}

/**
 * Source syntax that is not text: ${...} interpolations (the identifier inside
 * is Latin by definition) and escape sequences ("ორი\nხაზი" carries a literal
 * n against a Georgian letter that no reader ever sees).
 */
function normalize(span) {
  return span
    .replace(/\$\{[^}]*\}/g, " ")
    .replace(/\\u\{[0-9a-fA-F]+\}|\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}|\\./g, " ");
}

let failures = 0;
for (const file of targets()) {
  const source = readFileSync(file, "utf8");
  for (const raw of spans(source)) {
    const value = normalize(raw);
    if (!georgian.test(value)) continue;
    const chars = [...value];
    const foreign = (i) => chars[i] !== undefined && isLetter.test(chars[i]) && !georgian.test(chars[i]);
    const geo = (i) => chars[i] !== undefined && georgian.test(chars[i]);
    // Flag a foreign letter only where it TOUCHES a Georgian one. That is what
    // corruption looks like; a deliberate Latin token beside Georgian --
    // "super_admin-ის", "GR-კოდი", "5XX XX XX XX" -- never touches one, and
    // flagging those buries the real signal under 100+ false alarms.
    const offenders = [...new Set(chars.filter((_, i) => foreign(i) && (geo(i - 1) || geo(i + 1))))];
    if (offenders.length === 0) continue;
    console.log(
      "MIXED-SCRIPT " +
        file +
        "  " +
        raw.trim() +
        "  offending: " +
        offenders
          .map((ch) => "U+" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"))
          .join(" "),
    );
    failures++;
  }
}
console.log("mixed-script scan: " + (failures === 0 ? "clean" : failures + " impure span(s)"));
process.exit(failures === 0 ? 0 : 1);
