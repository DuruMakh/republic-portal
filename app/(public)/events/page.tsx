import type { Metadata } from "next";
import { EventRow } from "@/components/EventRow";
import { Eyebrow } from "@/components/Eyebrow";
import { SectionRule } from "@/components/SectionRule";
import { splitEvents } from "@/lib/community";
import { fetchPublicEvents } from "@/lib/supabase/public";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "ღონისძიებები — ქართული რესპუბლიკა",
  description: "მოძრაობის შეხვედრები და ღონისძიებები.",
  openGraph: { images: ["/og-default.png"] },
};

export default async function EventsPage() {
  const events = await fetchPublicEvents();
  const { upcoming, past } = splitEvents(events, new Date().toISOString());
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Eyebrow>ქართული რესპუბლიკა</Eyebrow>
      <h1 className="mt-1 font-serif text-4xl font-bold text-ink">ღონისძიებები</h1>

      <SectionRule label="მომავალი" className="mt-10" />
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
          <SectionRule label="გასული" className="mt-12" />
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
