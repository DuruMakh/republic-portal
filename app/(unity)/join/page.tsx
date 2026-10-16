import type { Metadata } from "next";
import { Suspense } from "react";
import JoinForm from "./JoinForm";

export const metadata: Metadata = {
  title: "რეგისტრაცია — ქართული რესპუბლიკა",
  description: "გახდი მხარდამჭერი — მხოლოდ ძირითადი მონაცემები, დანარჩენს კაბინეტში ნახავ.",
  openGraph: { images: ["/og-default.png"] },
};

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinForm />
    </Suspense>
  );
}
