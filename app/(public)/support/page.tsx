import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { SUPPORT_EYEBROW, SUPPORT_HEADING, SUPPORT_LEDE } from "@/lib/support-copy";
import { submitSupportMessageAction } from "./actions";
import { SupportForm } from "./SupportForm";

export const metadata: Metadata = { title: SUPPORT_HEADING };

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Eyebrow>{SUPPORT_EYEBROW}</Eyebrow>
      <h1 className="mt-1 font-serif text-4xl font-bold text-ink">{SUPPORT_HEADING}</h1>
      <p className="mt-3 font-serif text-[1.02rem] text-prose">{SUPPORT_LEDE}</p>
      <div className="mt-8">
        <Card>
          <SupportForm submit={submitSupportMessageAction} />
        </Card>
      </div>
    </main>
  );
}
