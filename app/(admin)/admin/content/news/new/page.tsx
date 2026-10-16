import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/AdminUi";
import { NewsForm } from "../NewsForm";

export const metadata: Metadata = { title: "ახალი სიახლე — ქართული რესპუბლიკა" };

export default function NewNewsPage() {
  return (
    <div>
      <AdminPageHeader title="ახალი სიახლე" />
      <NewsForm article={null} />
    </div>
  );
}
