export interface PublicDelegate {
  id: string;
  slug: string;
  first_name: string;
  last_name: string;
  region_id: number | null;
  region_name_ka: string | null;
  bio: string | null;
  photo_url: string | null;
  active_supporters: number;
}

export interface RankedDelegate extends PublicDelegate {
  rank: number;
}

interface Rankable {
  first_name: string;
  last_name: string;
  active_supporters: number;
}

const collator = new Intl.Collator("ka");

/** Supporters descending; ties by Georgian collation of "first last". Pure. */
export function rankDelegates<T extends Rankable>(rows: T[]): (T & { rank: number })[] {
  return [...rows]
    .sort(
      (a, b) =>
        b.active_supporters - a.active_supporters ||
        collator.compare(`${a.first_name} ${a.last_name}`, `${b.first_name} ${b.last_name}`)
    )
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

export function medalFor(rank: number): "🥇" | "🥈" | "🥉" | null {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}
