import type { Metadata } from "next";
import { EventForm } from "../EventForm";

export const metadata: Metadata = { title: "ახალი ღონისძიება — ქართული რესპუბლიკა" };

export default function NewEventPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-ink">ახალი ღონისძიება</h1>
      <EventForm event={null} />
    </div>
  );
}
