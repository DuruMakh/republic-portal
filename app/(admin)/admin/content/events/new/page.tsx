import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { AdminPageHeader } from "@/components/AdminUi";
import { notFound } from "next/navigation";
import { showEvents } from "@/lib/events-switch";
import { EventForm } from "../EventForm";

export const metadata: Metadata = { title: "ახალი ღონისძიება — ქართული რესპუბლიკა" };

export default function NewEventPage() {
  // Events hidden (the default, ADR-042): the page does not exist, even by its address.
  if (!showEvents()) notFound();
  return (
    <div>
      <AdminPageHeader title="ახალი ღონისძიება" />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card>
          <EventForm event={null} />
        </Card>
      </div>
    </div>
  );
}
