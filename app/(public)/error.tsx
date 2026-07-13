"use client";

import { Button } from "@/components/Button";

export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="font-serif text-3xl font-bold text-ink">დროებითი შეფერხება</h1>
      <p className="mt-3 text-muted-fg">გვერდის ჩატვირთვა ვერ მოხერხდა. სცადე თავიდან.</p>
      <div className="mt-6">
        <Button onClick={reset}>თავიდან ცდა</Button>
      </div>
    </main>
  );
}
