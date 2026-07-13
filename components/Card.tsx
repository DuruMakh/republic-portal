import type { ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-6 shadow-sm">
      {title ? <h3 className="mb-4 text-base font-bold text-ink">{title}</h3> : null}
      {children}
    </section>
  );
}
