import type { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-[0.7rem] font-bold uppercase tracking-[.18em] text-brand">{children}</div>
  );
}
