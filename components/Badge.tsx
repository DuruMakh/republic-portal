import type { ReactNode } from "react";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-brand px-1.5 text-[0.74rem] font-bold text-paper">
      {children}
    </span>
  );
}
