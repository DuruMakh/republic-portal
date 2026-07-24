import type { Metadata } from "next";
import { NewsForm } from "../NewsForm";

export const metadata: Metadata = { title: "ახალი სიახლე — ქართული რესპუბლიკა" };

export default function NewNewsPage() {
  return (
    <div>
      <div className="mb-8 border-b-2 border-ink pb-4">
        <h1 className="font-serif text-[2rem] font-bold text-ink">ახალი სიახლე</h1>
      </div>
      <NewsForm article={null} />
    </div>
  );
}
