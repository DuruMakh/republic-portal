import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { ContentBody } from "@/components/ContentBody";
import { Eyebrow } from "@/components/Eyebrow";
import { excerpt } from "@/lib/content-render";
import { eventEndIso, formatEventTimeKa } from "@/lib/community";
import { fetchPublicEventBySlug, fetchPublicEvents } from "@/lib/supabase/public";

export const revalidate = 60;

export async function generateStaticParams() {
  const events = await fetchPublicEvents();
  return events.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await fetchPublicEventBySlug(slug);
  if (!event) return { title: "ღონისძიება ვერ მოიძებნა — ქართული რესპუბლიკა" };
  return {
    title: `${event.title} — ქართული რესპუბლიკა`,
    description: `${formatEventTimeKa(event.starts_at, event.ends_at)} · ${event.location}`,
    openGraph: {
      title: event.title,
      description: excerpt(event.description),
      images: ["/og-default.png"],
    },
  };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await fetchPublicEventBySlug(slug);
  if (!event) notFound();
  // eslint-disable-next-line react-hooks/purity -- Server Component rendered per ISR regeneration (revalidate=60), not client-memoized; same now() read as splitEvents in the sibling /events list page
  const isPast = new Date(eventEndIso(event)).getTime() < Date.now();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/events" className="text-sm font-semibold text-brand hover:underline">
        ← ღონისძიებები
      </Link>
      <article className="mt-6">
        <Eyebrow>{formatEventTimeKa(event.starts_at, event.ends_at)}</Eyebrow>
        <h1 className="mt-1 font-serif text-4xl font-bold text-ink">{event.title}</h1>
        <p className="mt-2 font-semibold text-muted-fg">{event.location}</p>

        {event.status === "cancelled" ? (
          <p className="mt-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 font-semibold text-danger">
            ღონისძიება გაუქმებულია
          </p>
        ) : null}

        <ContentBody body={event.description} className="mt-6" />

        {event.status === "published" && !isPast ? (
          <div className="mt-8">
            <ButtonLink href="/me/events">დასწრების აღნიშვნა კაბინეტში</ButtonLink>
          </div>
        ) : null}
        {event.status === "published" && isPast ? (
          <p className="mt-8 text-sm font-semibold text-muted-fg">ღონისძიება დასრულებულია.</p>
        ) : null}
      </article>
    </main>
  );
}
