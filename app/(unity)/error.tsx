"use client";

import { UnityButton } from "@/components/UnityButton";
import { UnityNotice } from "@/components/UnityNotice";

export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <UnityNotice
      title="დროებითი შეფერხება"
      description="გვერდის ჩატვირთვა ვერ მოხერხდა. სცადე თავიდან."
      actions={<UnityButton onClick={reset}>თავიდან ცდა</UnityButton>}
    />
  );
}
