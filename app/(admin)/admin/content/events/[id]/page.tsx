import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { formatCountKa } from "@/lib/format";
import { isoToTbilisiLocal } from "@/lib/community";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventActions } from "../EventActions";
import { EventForm } from "../EventForm";

export const metadata: Metadata = { title: "ღონისძიების რედაქტირება — ქართული რესპუბლიკა" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: event, error } = await supabase
    .from("admin_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`admin_events by id failed: ${error.message}`);
  if (!event) notFound();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-ink">ღონისძიების რედაქტირება</h1>
        <Pill {...contentPill(event.status)} />
        <span className="text-sm font-semibold text-muted-fg">
          მოდის: {formatCountKa(event.going_count)}
        </span>
        {event.slug && event.status !== "draft" ? (
          <a
            href={`/events/${event.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-brand hover:underline"
          >
            ნახე საიტზე ↗
          </a>
        ) : null}
      </div>

      <EventForm
        event={{
          id: event.id,
          title: event.title,
          description: event.description,
          location: event.location,
          startsAtLocal: isoToTbilisiLocal(event.starts_at),
          endsAtLocal: event.ends_at ? isoToTbilisiLocal(event.ends_at) : "",
        }}
      />

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-muted-fg">მოქმედებები</h2>
        <EventActions
          id={event.id}
          status={event.status}
          everPublished={event.published_at !== null}
        />
      </div>
    </div>
  );
}
