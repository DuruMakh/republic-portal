import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { AdminPageHeader } from "@/components/AdminUi";
import { PollForm } from "../PollForm";

export const metadata: Metadata = { title: "ახალი გამოკითხვა — ქართული რესპუბლიკა" };

export default function NewPollPage() {
  return (
    <div>
      <AdminPageHeader title="ახალი გამოკითხვა" />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card>
          <PollForm poll={null} />
        </Card>
      </div>
    </div>
  );
}
