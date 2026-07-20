import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/Eyebrow";
import { Pill } from "@/components/Pill";
import { cardSkin } from "@/components/Card";
import { contentPill } from "@/lib/admin";
import { formatEventTimeKa, splitEvents } from "@/lib/community";
import { fetchPublicEvents, type PublicEventItem } from "@/lib/supabase/public";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "ღონისძიებები — ქართული რესპუბლიკა",
  description: "მოძრაობის შეხვედრები და ღონისძიებები.",
  openGraph: { images: ["/og-default.png"] },
};

function EventRow({ event }: { event: PublicEventItem }) {
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

export default async function EventsPage() {
  const events = await fetchPublicEvents();
  const { upcoming, past } = splitEvents(events, new Date().toISOString());
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>ქართული რესპუბლიკა</Eyebrow>
      <h1 className="mt-1 font-serif text-4xl font-bold text-ink">ღონისძიებები</h1>

      <h2 className="mt-10 text-lg font-bold text-ink">მომავალი</h2>
      {upcoming.length === 0 ? (
        <p className="mt-3 text-muted-fg">მომავალი ღონისძიებები მალე გამოცხადდება.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {upcoming.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>
      )}

      {past.length > 0 ? (
        <>
          <h2 className="mt-12 text-lg font-bold text-ink">გასული</h2>
          <div className="mt-3 flex flex-col gap-3">
            {past.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
