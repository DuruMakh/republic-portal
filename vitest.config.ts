import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    projects: [
      {
        // lib/ is pure domain logic (no React/Next imports — CLAUDE.md), so it runs in
        // plain node: no jsdom boot and no DOM setup file per test file. A lib test that
        // genuinely needs a DOM opts in with a `// @vitest-environment jsdom` docblock.
        extends: true,
        test: {
          name: "lib",
          environment: "node",
          // proxy.ts (the request proxy) is server code too.
          include: ["lib/**/*.test.ts", "proxy.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          // e2e/**/*.test.ts unit-tests the Playwright HELPERS (not the journeys, which are
          // e2e/**/*.spec.ts and belong to `npm run e2e` — see playwright.config.ts testMatch).
          include: [
            "components/**/*.test.tsx",
            "app/**/*.test.{ts,tsx}",
            "e2e/**/*.test.ts",
            "proxy.test.ts",
          ],
        },
      },
    ],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  esbuild: { jsx: "automatic" },
});
