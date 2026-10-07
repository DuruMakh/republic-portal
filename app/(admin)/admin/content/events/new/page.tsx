import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { showEvents } from "@/lib/events-switch";
import { EventForm } from "../EventForm";

export const metadata: Metadata = { title: "ახალი ღონისძიება — ქართული რესპუბლიკა" };

export default function NewEventPage() {
  // Events hidden (the default, ADR-038): the page does not exist, even by its address.
  if (!showEvents()) notFound();
  return (
    <div>
      <div className="mb-8 border-b-2 border-ink pb-4">
        <h1 className="font-serif text-[2rem] font-bold text-ink">ახალი ღონისძიება</h1>
      </div>
      <EventForm event={null} />
    </div>
  );
}
