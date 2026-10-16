import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventRow } from "@/components/EventRow";
import { NOT_FOUND_METADATA } from "@/components/NotFoundNotice";
import { UnityClosing } from "@/components/UnityClosing";
import { UnityPageHead, UnitySectionLabel } from "@/components/UnityPageHead";
import { splitEvents } from "@/lib/community";
import { showEvents } from "@/lib/events-switch";
import { CONTACT_CLOSING_LINK } from "@/lib/public-pages-copy";
import { fetchPublicEvents, type PublicEventItem } from "@/lib/supabase/public";

export const revalidate = 60;

const TITLE = "ღონისძიებები";
const INTRO = "მოძრაობის შეხვედრები და ღონისძიებები.";

const EVENTS_METADATA: Metadata = {
  title: `${TITLE} — ქართული რესპუბლიკა`,
  description: INTRO,
  openGraph: { images: ["/og-default.png"] },
};

// While hidden the page presents the generic not-found title, never its own — the same reason
// as the hidden finance page (ADR-034): a page-raised 404 still streams this page's metadata.
// While hidden, visitors normally never reach this branch: proxy.ts answers /events and every
// address below it with the site-wide not-found page first (ADR-040). It stays as a second line.
export function generateMetadata(): Metadata {
  return showEvents() ? EVENTS_METADATA : NOT_FOUND_METADATA;
}

export default async function EventsPage() {
  // Hidden by owner decision (ADR-042): not-found for everyone, before any data is fetched.
  // Set SHOW_EVENTS=true and redeploy to bring the page back as it was.
  if (!showEvents()) notFound();
  const events = await fetchPublicEvents();
  const { upcoming, past } = splitEvents(events, new Date().toISOString());
  return (
    <main aria-labelledby="page-title">
      <UnityPageHead kicker="ქართული რესპუბლიკა" title={TITLE} intro={INTRO} />
      <section className="pb-16 pt-2 sm:pb-[clamp(88px,9vw,136px)] sm:pt-0">
        <div className="unity-container">
          <UnitySectionLabel>მომავალი</UnitySectionLabel>
          {upcoming.length === 0 ? (
            <p className="m-0 mt-6 text-secondary">მომავალი ღონისძიებები მალე გამოცხადდება.</p>
          ) : (
            <EventList events={upcoming} />
          )}
          {past.length > 0 ? (
            <div className="mt-14 sm:mt-[72px]">
              <UnitySectionLabel>გასული</UnitySectionLabel>
              <EventList events={past} past />
            </div>
          ) : null}
        </div>
      </section>
      <UnityClosing link={CONTACT_CLOSING_LINK} />
    </main>
  );
}

function EventList({ events, past = false }: { events: PublicEventItem[]; past?: boolean }) {
  return (
    <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0 sm:mt-7 sm:gap-3.5">
      {events.map((e) => (
        <li key={e.id}>
          <EventRow event={e} past={past} />
        </li>
      ))}
    </ul>
  );
}
