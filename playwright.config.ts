import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // 150s per test: an admin loginAs may ride out one Supabase per-phone OTP-throttle
  // window (~62s wait) and still finish its remaining steps within a single test.
  timeout: 150_000,
  retries: process.env.CI ? 1 : 0,
  // shared staging state (per-run users + seed-count assertions) — spec files must never overlap
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    // Makes CountUp's animation effect (components/CountUp.tsx) short-circuit via its
    // matchMedia("(prefers-reduced-motion: reduce)") check, so e2e reads settled values
    // immediately — see the direct-read comment in e2e/public.spec.ts.
    contextOptions: { reducedMotion: "reduce" },
  },
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
