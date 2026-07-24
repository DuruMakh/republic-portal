// Usage:
//   node scripts/ka-gate.mjs --selftest
//   node scripts/ka-gate.mjs --diff <baseRef> <file> [...files]
// Diff mode checks ONLY lines added relative to <baseRef> (plus whole
// untracked files), so pre-existing quirks in old comments never block a
// task. A naive whole-file adjacency check is deliberately absent: an ASCII
// quote next to Georgian is usually just a TS string delimiter
// (label: "..."), and three legacy files carry historical ASCII-closed
// pairs in comments. Checks are built from escapes, never literal glyphs:
//   1. Greek look-alike characters
//   2. a U+201E opener whose next quote character is ASCII (the classic
//      silent-normalization corruption)
//   3. an ASCII quote BETWEEN two Georgian letters (never a delimiter)
//   4. unbalanced U+201E vs U+201C/U+201D across the added lines
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const Q_OPEN = "\\u201E";
const Q_CLOSE = "\\u201C\\u201D";
const GEO = "\\u10A0-\\u10FF\\u1C90-\\u1CBF\\u2D00-\\u2D2F";
const checks = [
  { name: "greek look-alike", re: new RegExp("\\p{Script=Greek}", "u") },
  {
    name: "U+201E closed by ASCII quote",
    re: new RegExp(Q_OPEN + "[^" + Q_CLOSE + "]{0,120}\\u0022", "u"),
  },
  {
    name: "ASCII quote inside a Georgian run",
    re: new RegExp("[" + GEO + "]\\u0022[" + GEO + "]", "u"),
  },
];

function scan(label, addedText) {
  const problems = checks.filter((c) => c.re.test(addedText)).map((c) => c.name);
  const nOpen = (addedText.match(new RegExp(Q_OPEN, "g")) || []).length;
  const nClose = (addedText.match(new RegExp("[" + Q_CLOSE + "]", "g")) || []).length;
  if (nOpen !== nClose) problems.push(`unbalanced quotes open=${nOpen} close=${nClose}`);
  if (problems.length > 0) {
    console.error(`FAIL ${label}: ${problems.join("; ")}`);
    return false;
  }
  console.log(`ok ${label} (open=${nOpen} close=${nClose})`);
  return true;
}

if (args[0] === "--selftest") {
  const g = (cp) => String.fromCodePoint(cp);
  const cases = [
    {
      label: "good: delimited literal + proper pair",
      text: 'label: "' + g(0x10d0) + g(0x10d1) + '" ' + g(0x201e) + g(0x10d2) + g(0x201c),
      expectOk: true,
    },
    { label: "bad: ASCII-closed opener", text: g(0x201e) + g(0x10d2) + '"', expectOk: false },
    { label: "bad: quote inside Georgian run", text: g(0x10d0) + '"' + g(0x10d1), expectOk: false },
    { label: "bad: Greek alpha", text: g(0x3b1), expectOk: false },
  ];
  let pass = true;
  for (const c of cases) {
    if (scan(c.label, c.text) !== c.expectOk) {
      pass = false;
      console.error(`selftest MISMATCH on: ${c.label}`);
    }
  }
  console.log(pass ? "selftest PASS" : "selftest FAIL");
  process.exit(pass ? 0 : 1);
}

if (args[0] !== "--diff" || args.length < 3) {
  console.error("usage: ka-gate.mjs --selftest | --diff <baseRef> <file...>");
  process.exit(2);
}
const [, base, ...files] = args;
let failed = false;
for (const f of files) {
  const status = execFileSync("git", ["status", "--porcelain", "--", f], { encoding: "utf8" });
  let added;
  if (status.startsWith("??")) {
    added = readFileSync(f, "utf8");
  } else {
    const diff = execFileSync("git", ["diff", base, "--", f], { encoding: "utf8" });
    added = diff
      .split("\n")
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
      .map((l) => l.slice(1))
      .join("\n");
  }
  if (!scan(f, added)) failed = true;
}
process.exit(failed ? 1 : 0);
