import Link from "next/link";
import { cardSkin } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { formatEventTimeKa } from "@/lib/community";
import type { PublicEventItem } from "@/lib/supabase/public";

/** One event line -- the date/title/location row shared by /events and the homepage. */
export function EventRow({ event }: { event: PublicEventItem }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className={`${cardSkin} flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition-colors hover:border-brand/50`}
    >
      <span className="text-sm font-semibold text-muted-fg">
        {formatEventTimeKa(event.starts_at, event.ends_at)}
      </span>
      <span className="font-bold text-ink">{event.title}</span>
      <span className="text-sm text-muted-fg">{event.location}</span>
      {event.status === "cancelled" ? <Pill {...contentPill("cancelled")} /> : null}
    </Link>
  );
}
