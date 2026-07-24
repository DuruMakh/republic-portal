import type { Metadata } from "next";
import { PollForm } from "../PollForm";

export const metadata: Metadata = { title: "ახალი გამოკითხვა — ქართული რესპუბლიკა" };

export default function NewPollPage() {
  return (
    <div>
      <div className="mb-8 border-b-2 border-ink pb-4">
        <h1 className="font-serif text-[2rem] font-bold text-ink">ახალი გამოკითხვა</h1>
      </div>
      <PollForm poll={null} />
    </div>
  );
}
