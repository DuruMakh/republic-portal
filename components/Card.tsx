import type { ReactNode } from "react";

export const cardSkin = "border border-hairline bg-paper-bright";
// Call-out surface (spec §2.1): same bright paper, full ink border instead of the
// hairline — the one mechanism every later call-out (news box, my-delegate card,
// poll teaser, clipping card, verification cards) swaps to via `variant="callout"`.
const cardSkinCallout = "border border-ink bg-paper-bright";

export function Card({
  title,
  header,
  padded = true,
  variant,
  children,
}: {
  title?: string;
  header?: ReactNode;
  padded?: boolean;
  variant?: "callout";
  children: ReactNode;
}) {
  const skin = variant === "callout" ? cardSkinCallout : cardSkin;
  const body = (
    <>
      {title ? <h3 className="mb-4 text-base font-bold text-ink">{title}</h3> : null}
      {children}
    </>
  );
  if (!header && padded) {
    return <section className={`${skin} p-6`}>{body}</section>;
  }
  return (
    <section className={`${skin}${header ? " overflow-hidden" : ""}`}>
      {header ? (
        <div className="text-[0.7rem] font-bold uppercase tracking-[.18em] text-muted-fg border-b-2 border-ink pb-2 mb-4">
          {header}
        </div>
      ) : null}
      <div className={padded ? "p-6" : "p-0"}>{body}</div>
    </section>
  );
}
