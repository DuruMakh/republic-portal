export interface PublicDelegate {
  id: string;
  slug: string;
  first_name: string;
  last_name: string;
  region_id: number | null;
  region_name_ka: string | null;
  bio: string | null;
  photo_url: string | null;
  /** Paying members only; kept for finance tooling, not shown while dues are dropped. */
  active_supporters: number;
  /** Every member in the delegate's team — what the ranking counts (ADR-037). */
  members: number;
}

export interface RankedDelegate extends PublicDelegate {
  rank: number;
}

interface Rankable {
  first_name: string;
  last_name: string;
  members: number;
}

const collator = new Intl.Collator("ka");

/** Members descending; ties by Georgian collation of "first last". Pure. */
export function rankDelegates<T extends Rankable>(rows: T[]): (T & { rank: number })[] {
  return [...rows]
    .sort(
      (a, b) =>
        b.members - a.members ||
        collator.compare(`${a.first_name} ${a.last_name}`, `${b.first_name} ${b.last_name}`),
    )
    .map((row, i) => ({ ...row, rank: i + 1 }));
}
