import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { formatCountKa } from "@/lib/format";
import { formatEventTimeKa, rsvpOpen, splitEvents } from "@/lib/community";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventRsvp } from "./EventRsvp";

export const metadata: Metadata = { title: "ღონისძიებები — ქართული რესპუბლიკა" };

export default async function MemberEventsPage() {
  const supabase = await createServerSupabase();
  const [eventsRes, countsRes, mineRes] = await Promise.all([
    supabase.from("public_events").select("*"),
    supabase.from("member_event_going_counts").select("*"),
    supabase.from("event_rsvps").select("event_id, status"),
  ]);
  if (eventsRes.error) throw new Error(`public_events failed: ${eventsRes.error.message}`);
  if (countsRes.error) throw new Error(`going counts failed: ${countsRes.error.message}`);
  if (mineRes.error) throw new Error(`own rsvps failed: ${mineRes.error.message}`);

  const nowIso = new Date().toISOString();
  const goingByEvent = new Map((countsRes.data ?? []).map((c) => [c.event_id, c.going]));
  const myStatusByEvent = new Map((mineRes.data ?? []).map((r) => [r.event_id, r.status]));
  const { upcoming, past } = splitEvents(eventsRes.data ?? [], nowIso);

  return (
    <main>
      <h1 className="text-2xl font-bold text-ink">ღონისძიებები</h1>
      <p className="mt-1 text-sm text-muted-fg">აღნიშნე დასწრება — გუნდი შენზეა დამოკიდებული.</p>

      <div className="mt-6 flex flex-col gap-4">
        {upcoming.length === 0 ? (
          <p className="text-muted-fg">მომავალი ღონისძიებები მალე გამოცხადდება.</p>
        ) : (
          upcoming.map((e) => (
            <Card key={e.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-muted-fg">
                    {formatEventTimeKa(e.starts_at, e.ends_at)} · {e.location}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-ink">{e.title}</h3>
                  <p className="mt-1 text-sm text-muted-fg">
                    სულ მოდის {formatCountKa(goingByEvent.get(e.id) ?? 0)} მონაწილე
                  </p>
                </div>
                {e.status === "cancelled" ? <Pill {...contentPill("cancelled")} /> : null}
              </div>
              <div className="mt-4">
                <EventRsvp
                  eventId={e.id}
                  status={myStatusByEvent.get(e.id) ?? null}
                  open={rsvpOpen(e, nowIso)}
                />
              </div>
            </Card>
          ))
        )}
      </div>

      {past.length > 0 ? (
        <>
          <h2 className="mt-10 text-lg font-bold text-ink">გასული</h2>
          <div className="mt-3 flex flex-col gap-2">
            {past.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm"
              >
                <span className="font-semibold text-muted-fg">
                  {formatEventTimeKa(e.starts_at, e.ends_at)}
                </span>
                <span className="font-semibold text-ink">{e.title}</span>
                {myStatusByEvent.get(e.id) === "going" ? (
                  <span className="text-xs font-semibold text-ok">დაესწარი ✓</span>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
