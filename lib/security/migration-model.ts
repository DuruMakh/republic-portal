import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Static model of the applied migrations for tests: read the real SQL, never a copy.
 * Postgres applies files in filename order, so "last in this string" = "live".
 */
const MIGRATIONS_DIR = resolve("supabase/migrations");

export function orderedMigrationSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => `\n-- file: ${file}\n${readFileSync(join(MIGRATIONS_DIR, file), "utf8")}`)
    .join("");
}

export function latestDefinition(fn: string): string {
  const sql = orderedMigrationSql();
  const header = new RegExp(`create (?:or replace )?function\\s+(?:public\\.)?${fn}\\s*\\(`, "g");
  let found: string | undefined;
  for (const match of sql.matchAll(header)) {
    const open = sql.indexOf("$$", match.index);
    const close = sql.indexOf("$$", open + 2);
    if (open < 0 || close < 0) continue;
    found = sql.slice(match.index, close);
  }
  if (found === undefined) throw new Error(`no definition of ${fn} in the migrations`);
  return found;
}

export function lastMatchIndex(sql: string, pattern: RegExp): number {
  let last = -1;
  for (const match of sql.matchAll(pattern)) last = match.index;
  return last;
}
