import type { ReactNode } from "react";
import { useCopy } from "@/lib/i18n/copy";

export function CenteredNotice({
  title,
  description,
  actions,
  decoration,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  decoration?: ReactNode;
}) {
  const t = useCopy();
  return (
    <main className="mx-auto max-w-lg border-y-2 border-ink py-10 text-center">
      {decoration}
      <h1 className="font-serif text-4xl font-bold text-ink">{t(title)}</h1>
      {description ? <p className="mx-auto mt-4 max-w-md text-muted-fg">{t(description)}</p> : null}
      {actions ? <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </main>
  );
}
