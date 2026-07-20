import type { Metadata } from "next";
import { PollForm } from "../PollForm";

export const metadata: Metadata = { title: "ახალი გამოკითხვა — ქართული რესპუბლიკა" };

export default function NewPollPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-ink">ახალი გამოკითხვა</h1>
      <PollForm poll={null} />
    </div>
  );
}
