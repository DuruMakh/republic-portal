import type { ReactNode } from "react";

/**
 * Additive `tone` (Task 18, D10): default `brand` is byte-identical to the
 * original hardcoded look every existing caller (CabinetNav, AdminNav) already
 * relies on; `warn` is the amber override AdminNav reaches for on the
 * verification-queue tab specifically; `sand` is the cabinet's wine-band count (ერთობა redesign).
 */
export function Badge({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "warn" | "sand";
}) {
  return (
    <span
      className={`inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1.5 text-[0.74rem] font-bold ${
        tone === "warn"
          ? "bg-warn text-paper"
          : tone === "sand"
            ? "bg-sand text-wine"
            : "bg-brand text-paper"
      }`}
    >
      {children}
    </span>
  );
}
