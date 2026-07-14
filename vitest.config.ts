import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  esbuild: { jsx: "automatic" },
});
