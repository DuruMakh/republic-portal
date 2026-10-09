/**
 * Points the app at the local Supabase stack (README Quickstart, ADR-051): reads
 * `supabase status -o env` and writes `.env.development.local`, which `next dev` and the
 * seed/e2e scripts read ahead of `.env.local`. Same settings and test-mode flags as CI.
 *
 * Run: node scripts/local-db-env.mjs   (after `npm run db:start` has started the stack)
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SETTINGS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const LOCAL_URLS = ["http://127.0.0.1:54321", "http://localhost:54321"];
// The CI build's test-mode flags (.github/workflows/ci.yml).
const TEST_MODE = {
  NEXT_PUBLIC_APP_ENV: "preview",
  PHONE_VERIFICATION_PROVIDER: "test",
  NEXT_PUBLIC_AUTH_MODE: "google",
};

/** @param {string} statusOutput */
export function localEnvFile(statusOutput) {
  const found = new Map();
  for (const line of statusOutput.split(/\r?\n/)) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match && SETTINGS.includes(match[1])) found.set(match[1], match[2].replace(/^"|"$/g, ""));
  }
  for (const name of SETTINGS) {
    if (!found.get(name)) throw new Error(`supabase status did not report ${name}`);
  }
  if (!LOCAL_URLS.includes(found.get("NEXT_PUBLIC_SUPABASE_URL"))) {
    throw new Error("Refusing: the Supabase address is not the local stack");
  }
  const lines = [
    "# Written by scripts/local-db-env.mjs: the local Supabase stack. Safe to delete.",
    ...SETTINGS.map((name) => `${name}=${found.get(name)}`),
    ...Object.entries(TEST_MODE).map(([name, value]) => `${name}=${value}`),
  ];
  return lines.join("\n") + "\n";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // One constant command string: no user input reaches the shell.
  const status = execSync(
    "npx --yes supabase@2.109.1 status -o env" +
      " --override-name api.url=NEXT_PUBLIC_SUPABASE_URL" +
      " --override-name auth.anon_key=NEXT_PUBLIC_SUPABASE_ANON_KEY" +
      " --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY",
    { encoding: "utf8" },
  );
  writeFileSync(".env.development.local", localEnvFile(status));
  console.log("Wrote .env.development.local for the local Supabase stack.");
}
