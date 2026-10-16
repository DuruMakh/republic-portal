"use client";

import { Button } from "@/components/Button";
import { CenteredNotice } from "@/components/CenteredNotice";

export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <CenteredNotice
      title="დროებითი შეფერხება"
      description="გვერდის ჩატვირთვა ვერ მოხერხდა. სცადე თავიდან."
      actions={<Button onClick={reset}>თავიდან ცდა</Button>}
    />
  );
}
