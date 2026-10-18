import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentBody } from "@/components/ContentBody";
import { NOT_FOUND_METADATA } from "@/components/NotFoundNotice";
import { UnityClosing } from "@/components/UnityClosing";
import { UnityArticleHead } from "@/components/UnityPageHead";
import { excerpt } from "@/lib/content-render";
import { eventEndIso, formatEventTimeKa } from "@/lib/community";
import { showEvents } from "@/lib/events-switch";
import { CONTACT_CLOSING_LINK } from "@/lib/public-pages-copy";
import { fetchPublicEventBySlug, fetchPublicEvents } from "@/lib/supabase/public";
import { generateMetadata as notFoundMetadata } from "./not-found";

export const revalidate = 60;

const BACK = "← ღონისძიებები";

export async function generateStaticParams() {
  // Hidden (ADR-042): build no event pages; any address falls through to the not-found below.
  if (!showEvents()) return [];
  const events = await fetchPublicEvents();
  return events.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  // While hidden, a real event's address must not leak its title through the 404's metadata.
  if (!showEvents()) return NOT_FOUND_METADATA;
  const { slug } = await params;
  const event = await fetchPublicEventBySlug(slug);
  if (!event) return notFoundMetadata();
  return {
    title: `${event.title} — ქართული რესპუბლიკა`,
    description: `${formatEventTimeKa(event.starts_at, event.ends_at)} · ${event.location}`,
    openGraph: {
      title: event.title,
      description: excerpt(event.description),
      images: ["/og-default.png?v=civic-portal"],
    },
  };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  // Hidden by owner decision (ADR-042): not-found before the event is read.
  if (!showEvents()) notFound();
  const { slug } = await params;
  const event = await fetchPublicEventBySlug(slug);
  if (!event) notFound();

  // eslint-disable-next-line react-hooks/purity -- Server Component rendered per ISR regeneration (revalidate=60), not client-memoized; same now() read as splitEvents in the sibling /events list page
  const isPast = new Date(eventEndIso(event)).getTime() < Date.now();

  return (
    <main aria-labelledby="page-title">
      <section className="pb-16 pt-7 sm:pb-[clamp(88px,9vw,136px)] sm:pt-[clamp(56px,6vw,88px)]">
        <div className="unity-container">
          <article className="mx-auto max-w-[860px]">
            <UnityArticleHead
              backHref="/events"
              backLabel={BACK}
              kicker={formatEventTimeKa(event.starts_at, event.ends_at)}
              title={event.title}
            />
            <p className="m-0 mt-4 flex items-center gap-2.5 text-[15px] font-semibold text-secondary sm:mt-[22px] sm:text-[16px]">
              <span
                aria-hidden="true"
                className="inline-block h-[11px] w-3.5 flex-none rounded-[48%_52%_55%_45%/50%_46%_54%_50%] bg-brand"
              />
              {event.location}
            </p>

            {event.status === "cancelled" ? (
              <p className="m-0 mt-8 border-l-4 border-brand bg-sandstone px-5 py-4 font-semibold text-brand">
                ღონისძიება გაუქმებულია
              </p>
            ) : null}

            <div className="mt-8 border-t border-rule pt-8 sm:mt-10 sm:pt-10">
              <ContentBody body={event.description} reading />
            </div>

            {event.status === "published" && !isPast ? (
              <Link
                href="/me/events"
                className="mt-[38px] flex min-h-[60px] items-center justify-between gap-4 border border-ink px-5 text-[16px] font-bold text-ink no-underline transition-colors hover:bg-ink hover:text-limestone sm:min-h-[68px] sm:px-7 sm:text-[17px]"
              >
                <span>დასწრების აღნიშვნა კაბინეტში</span>
                <span aria-hidden="true" className="text-[22px]">
                  →
                </span>
              </Link>
            ) : null}
            {event.status === "published" && isPast ? (
              <p className="m-0 mt-[38px] text-[15px] font-semibold text-secondary">
                ღონისძიება დასრულებულია.
              </p>
            ) : null}
          </article>
        </div>
      </section>
      <UnityClosing link={CONTACT_CLOSING_LINK} />
    </main>
  );
}
