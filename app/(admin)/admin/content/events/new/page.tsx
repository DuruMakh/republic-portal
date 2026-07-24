import type { Metadata } from "next";
import { EventForm } from "../EventForm";

export const metadata: Metadata = { title: "ახალი ღონისძიება — ქართული რესპუბლიკა" };

export default function NewEventPage() {
  return (
    <div>
      <div className="mb-8 border-b-2 border-ink pb-4">
        <h1 className="font-serif text-[2rem] font-bold text-ink">ახალი ღონისძიება</h1>
      </div>
      <EventForm event={null} />
    </div>
  );
}
