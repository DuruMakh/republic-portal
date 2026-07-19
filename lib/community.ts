/**
 * Pure domain logic for Phase 5 (spec §5): event windows, poll view states,
 * result percentages, and the Tbilisi wall-time bridge for datetime-local
 * inputs. All instants compare as epoch ms; wall-time math shifts by the fixed
 * TBILISI_OFFSET_MS (Georgia is UTC+4 year-round — ADR-016).
 */
import { formatDateKa, TBILISI_OFFSET_MS } from "./cabinet";

export interface EventTimeFields {
  starts_at: string;
  ends_at: string | null;
}

export function eventEndIso(e: EventTimeFields): string {
  return e.ends_at ?? e.starts_at;
}

export function splitEvents<T extends EventTimeFields>(
  events: readonly T[],
  nowIso: string,
): { upcoming: T[]; past: T[] } {
  const now = new Date(nowIso).getTime();
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const e of events) {
    (new Date(eventEndIso(e)).getTime() >= now ? upcoming : past).push(e);
  }
  upcoming.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  past.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  return { upcoming, past };
}

export function rsvpOpen(e: { starts_at: string; status: string }, nowIso: string): boolean {
  return e.status === "published" && new Date(nowIso).getTime() < new Date(e.starts_at).getTime();
}

export type PollViewState = "buttons" | "results-own" | "results-closed";

/** Decision #4: voters see results while open; after close, everyone does. */
export function pollView(status: "open" | "closed", hasVoted: boolean): PollViewState {
  if (status === "closed") return "results-closed";
  return hasVoted ? "results-own" : "buttons";
}

/** Integer percentages summing to exactly 100 (largest remainder; ties → lower index). */
export function percentages(votes: readonly number[]): number[] {
  const total = votes.reduce((s, v) => s + v, 0);
  if (total === 0) return votes.map(() => 0);
  const exact = votes.map((v) => (v * 100) / total);
  const out = exact.map(Math.floor);
  let remainder = 100 - out.reduce((s, v) => s + v, 0);
  const byFraction = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byFraction) {
    if (remainder <= 0) break;
    out[i] = (out[i] ?? 0) + 1;
    remainder--;
  }
  return out;
}

const LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** `<input type="datetime-local">` value (Tbilisi wall time) → ISO UTC instant. */
export function tbilisiLocalToIso(local: string): string | null {
  if (!LOCAL_RE.test(local)) return null;
  const wallAsUtc = Date.parse(`${local}:00.000Z`);
  if (Number.isNaN(wallAsUtc)) return null;
  return new Date(wallAsUtc - TBILISI_OFFSET_MS).toISOString();
}

function toTbilisiParts(iso: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + TBILISI_OFFSET_MS);
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** ISO instant → `"YYYY-MM-DDTHH:mm"` in Tbilisi wall time (datetime-local prefill). */
export function isoToTbilisiLocal(iso: string): string {
  const t = toTbilisiParts(iso);
  if (!t) return "";
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}T${pad2(
    t.getUTCHours(),
  )}:${pad2(t.getUTCMinutes())}`;
}

function timeKa(iso: string): string {
  const t = toTbilisiParts(iso);
  if (!t) return "";
  return `${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}`;
}

export function formatEventTimeKa(startsAt: string, endsAt: string | null): string {
  const startDate = formatDateKa(startsAt);
  const startTime = timeKa(startsAt);
  if (!endsAt) return `${startDate}, ${startTime}`;
  const endDate = formatDateKa(endsAt);
  const endTime = timeKa(endsAt);
  if (endDate === startDate) return `${startDate}, ${startTime}–${endTime}`;
  return `${startDate}, ${startTime} — ${endDate}, ${endTime}`;
}

/** Mirrors one delegate_team_rsvps() jsonb element (spec §4.5). */
export interface TeamRsvpName {
  firstName: string;
  lastName: string;
}

export interface TeamRsvpEvent {
  eventId: string;
  title: string;
  startsAt: string;
  goingCount: number;
  going: TeamRsvpName[];
}
