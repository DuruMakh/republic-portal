import type { Metadata } from "next";
import { NewsForm } from "../NewsForm";

export const metadata: Metadata = { title: "ახალი სიახლე — ქართული რესპუბლიკა" };

export default function NewNewsPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-ink">ახალი სიახლე</h1>
      <NewsForm article={null} />
    </div>
  );
}
