import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // e2e/**/*.test.ts unit-tests the Playwright HELPERS (not the journeys, which are
    // e2e/**/*.spec.ts and belong to `npm run e2e` — see playwright.config.ts testMatch).
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.tsx",
      "app/**/*.test.{ts,tsx}",
      "e2e/**/*.test.ts",
    ],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  esbuild: { jsx: "automatic" },
});
