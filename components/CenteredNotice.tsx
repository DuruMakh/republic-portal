import type { ReactNode } from "react";

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
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      {decoration}
      <h1 className="font-serif text-4xl font-bold text-ink">{title}</h1>
      {description ? <p className="mx-auto mt-4 max-w-md text-muted-fg">{description}</p> : null}
      {actions ? <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </main>
  );
}
