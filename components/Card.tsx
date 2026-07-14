import type { ReactNode } from "react";

export const cardSkin = "rounded-xl border border-line bg-white shadow-sm";

export function Card({
  title,
  header,
  padded = true,
  children,
}: {
  title?: string;
  header?: ReactNode;
  padded?: boolean;
  children: ReactNode;
}) {
  const body = (
    <>
      {title ? <h3 className="mb-4 text-base font-bold text-ink">{title}</h3> : null}
      {children}
    </>
  );
  if (!header && padded) {
    return <section className={`${cardSkin} p-6`}>{body}</section>;
  }
  return (
    <section className={`${cardSkin}${header ? " overflow-hidden" : ""}`}>
      {header ? (
        <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
          {header}
        </div>
      ) : null}
      <div className={padded ? "p-6" : "p-0"}>{body}</div>
    </section>
  );
}
