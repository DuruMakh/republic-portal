import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // .claude/** holds agent state, including git worktrees — each a full copy of
  // this repo. Without it, `npm run lint` lints every worktree's sources as well
  // as our own and reports tens of thousands of duplicate problems. Untracked, so
  // CI (a fresh clone) never had them: this only makes local match CI.
  globalIgnores([".next/**", ".claude/**", "node_modules/**", "prototype/**", "public/sw.js"]),
]);

export default eslintConfig;
