import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinChoice } from "./JoinChoice";

export const metadata: Metadata = {
  title: "გაწევრიანება — ქართული რესპუბლიკა",
  description: "გახდი ქართული რესპუბლიკის წევრი ან დელეგატი — რეგისტრაცია რამდენიმე წუთში.",
};

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinChoice />
    </Suspense>
  );
}
