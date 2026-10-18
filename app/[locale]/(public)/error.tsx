"use client";

import { Button } from "@/components/Button";
import { CenteredNotice } from "@/components/CenteredNotice";
import { useCopy } from "@/lib/i18n/copy";

export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  const t = useCopy();
  return (
    <CenteredNotice
      title="დროებითი შეფერხება"
      description="გვერდის ჩატვირთვა ვერ მოხერხდა. სცადე თავიდან."
      actions={<Button onClick={reset}>{t("თავიდან ცდა")}</Button>}
    />
  );
}
