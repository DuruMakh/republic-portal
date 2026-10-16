import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { AdminPageHeader, AdminSectionTitle } from "@/components/AdminUi";
import { notFound } from "next/navigation";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { formatCountKa } from "@/lib/format";
import { isoToTbilisiLocal } from "@/lib/community";
import { showEvents } from "@/lib/events-switch";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventActions } from "../EventActions";
import { EventForm } from "../EventForm";

export const metadata: Metadata = { title: "ღონისძიების რედაქტირება — ქართული რესპუბლიკა" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  // Events hidden (the default, ADR-042): the page does not exist, even by its address.
  if (!showEvents()) notFound();
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
      <AdminPageHeader
        title="ღონისძიების რედაქტირება"
        meta={
          <>
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
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card>
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
        </Card>

        <Card>
          <AdminSectionTitle className="mb-5">მოქმედებები</AdminSectionTitle>
          <EventActions
            id={event.id}
            status={event.status}
            everPublished={event.published_at !== null}
          />
        </Card>
      </div>
    </div>
  );
}
