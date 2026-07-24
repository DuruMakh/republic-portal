import type { Surface, SurfaceKind } from "./types";

export interface LiveObject {
  readonly kind: SurfaceKind;
  readonly name: string;
}

export interface Reconciliation {
  readonly added: string[];
  readonly removed: string[];
  readonly unchanged: number;
}

/**
 * Compares the committed manifest against a live snapshot of the database
 * catalog. Only `layer: "db"` entries participate — app-layer entries
 * (server actions, the dev OTP endpoint, storage buckets) cannot be
 * introspected from Postgres's catalog, so they are enumerated by hand
 * elsewhere and must never be reported as "removed" just because they don't
 * appear in a SQL query result.
 */
export function reconcile(
  manifest: readonly Surface[],
  live: readonly LiveObject[],
): Reconciliation {
  const dbEntries = manifest.filter((s) => s.layer === "db");
  const manifestIds = new Set(dbEntries.map((s) => s.id));
  const liveIds = new Set(live.map((o) => `${o.kind}:${o.name}`));

  return {
    added: [...liveIds].filter((id) => !manifestIds.has(id)).sort(),
    removed: [...manifestIds].filter((id) => !liveIds.has(id)).sort(),
    unchanged: [...manifestIds].filter((id) => liveIds.has(id)).length,
  };
}
