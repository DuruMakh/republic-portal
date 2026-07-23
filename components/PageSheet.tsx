import type { ReactNode } from "react";

/**
 * The paper sheet the whole site sits on (spec §3.1): a bounded column against
 * the darker stone body background, with a bordered edge once there's room for
 * one (`sm:border-x`). `min-h-screen` + `flex flex-col` so a SiteFooter child
 * pins to the bottom on short pages instead of floating mid-viewport.
 */
export function PageSheet({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto flex min-h-screen w-full max-w-[1280px] flex-col bg-paper sm:border-x sm:border-frame ${className}`.trim()}
    >
      {children}
    </div>
  );
}
