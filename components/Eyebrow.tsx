import type { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-extrabold uppercase tracking-wider text-brand">{children}</div>
  );
}
