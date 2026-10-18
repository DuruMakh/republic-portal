"use client";

import { UnityButton } from "@/components/UnityButton";
import { UnityNotice } from "@/components/UnityNotice";
import { useCopy } from "@/lib/i18n/copy";

export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  const t = useCopy();
  return (
    <UnityNotice
      title="დროებითი შეფერხება"
      description="გვერდის ჩატვირთვა ვერ მოხერხდა. სცადე თავიდან."
      actions={<UnityButton onClick={reset}>{t("თავიდან ცდა")}</UnityButton>}
    />
  );
}
