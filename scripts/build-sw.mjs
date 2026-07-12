// Bundles app/sw.ts into public/sw.js. Runs as the "postbuild" step, after `next
// build` (Turbopack). See app/sw.ts and DECISIONS.md ADR-008 for why this exists
// instead of the @serwist/next webpack plugin.
import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["app/sw.ts"],
  outfile: "public/sw.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
});
console.log("public/sw.js written");
