// Bundles app/sw.ts into public/sw.js. Runs as the "postbuild" step, after `next
// build` (Turbopack). See app/sw.ts and DECISIONS.md ADR-008 for why this exists
// instead of the @serwist/next webpack plugin.
import esbuild from "esbuild";
import { execSync } from "node:child_process";

// Per-deploy revision for the precache entries in app/sw.ts: without revision
// info, precached URLs ("/offline", icons, manifest, ...) would be served cache-first and
// frozen at install time, never refreshing across deploys. Git short SHA when
// available (CI builds run post-commit, so it changes per deploy); timestamp
// fallback keeps non-git builds correct too.
let revision = "";
try {
  revision = execSync("git rev-parse --short HEAD", {
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString()
    .trim();
} catch {
  // git unavailable (e.g. building from an exported tarball) — fall through.
}
if (revision === "") revision = String(Date.now());

await esbuild.build({
  entryPoints: ["app/sw.ts"],
  outfile: "public/sw.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": '"production"',
    __SW_REVISION__: JSON.stringify(revision),
  },
});
console.log(`public/sw.js written (revision ${revision})`);
