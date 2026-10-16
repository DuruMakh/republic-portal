import type { ReactNode } from "react";
import { Caps } from "@/components/Caps";
import { UnityKicker } from "@/components/UnityKicker";

/**
 * Building blocks for the cabinet pages of the owner's „ერთობა“ redesign (პირადი კაბინეტი
 * page of the design canvas). Every cabinet page is a CabinetPage holding a CabinetHead and
 * panels; nothing here fetches or decides anything.
 */

const DECO = {
  // The interlaced knot, top right of the supporter screens.
  knot: "/unity/knot-cream.svg",
  // The dotted map of Georgia, top right of the member and delegate screens.
  map: "/cabinet/map-dots-light.svg",
} as const;

export function CabinetPage({ children, deco }: { children: ReactNode; deco?: keyof typeof DECO }) {
  return (
    <main className="relative overflow-hidden">
      <section className="pb-14 pt-7 md:pb-32 md:pt-14">
        <div className="unity-container relative">
          {deco ? (
            // eslint-disable-next-line @next/next/no-img-element -- decorative backdrop
            <img
              src={DECO[deco]}
              alt=""
              aria-hidden="true"
              className={`pointer-events-none absolute hidden h-auto max-w-none md:block ${
                deco === "knot"
                  ? "-right-[150px] -top-24 w-[520px]"
                  : "-right-10 -top-[58px] w-[470px] opacity-70"
              }`}
            />
          ) : null}
          {children}
        </div>
      </section>
    </main>
  );
}

/** The page opening: optional kicker, the headline, an optional lede, and a 2px ink rule. */
export function CabinetHead({
  kicker,
  title,
  face = "display",
  lede,
  aside,
  asideInline = false,
  children,
}: {
  kicker?: string;
  title: ReactNode;
  /** `display` is the tall GL Gordeziani headline; `serif` is for names and titles. */
  face?: "display" | "serif";
  lede?: ReactNode;
  /** Shown beside the headline (pills, status), wrapping under it on narrow screens. */
  aside?: ReactNode;
  /** Sit the aside right after the headline instead of at the far end of the row. */
  asideInline?: boolean;
  children?: ReactNode;
}) {
  const h1 =
    face === "display"
      ? "font-display text-[48px] font-bold leading-[.94] md:text-[clamp(56px,5.6vw,84px)] md:leading-[.92]"
      : "font-serif text-[34px] font-semibold leading-[1.15] md:text-[clamp(44px,4.4vw,60px)] md:leading-[1.12]";
  return (
    <div className="relative border-b-2 border-ink pb-6 md:pb-[34px]">
      {kicker ? <UnityKicker className="mb-4 md:mb-[22px]">{kicker}</UnityKicker> : null}
      <div
        className={`flex flex-wrap items-center gap-y-3 ${asideInline ? "gap-x-6" : "justify-between gap-x-10"}`}
      >
        <h1 className={`m-0 text-balance tracking-[-.005em] ${h1}`}>{title}</h1>
        {aside}
      </div>
      {lede ? (
        <p className="mt-3.5 mb-0 max-w-[38em] font-serif text-[17px] leading-[1.6] text-prose md:mt-5 md:text-[21px]">
          {lede}
        </p>
      ) : null}
      {children}
    </div>
  );
}

const PANEL = {
  plain: "border border-rule bg-chalk text-ink",
  ink: "border border-ink bg-chalk text-ink",
  teal: "border border-teal bg-chalk text-ink",
  wine: "bg-wine text-sand [&_:focus-visible]:outline-limestone",
} as const;

/** A boxed panel: chalk with a rule, ink or teal border, or the wine call-out band. */
export function CabinetPanel({
  children,
  tone = "plain",
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  tone?: keyof typeof PANEL;
  className?: string;
  as?: "section" | "div" | "aside" | "article";
}) {
  return (
    <Tag className={`relative overflow-hidden p-6 md:p-9 ${PANEL[tone]} ${className}`}>
      {tone === "wine" ? (
        // eslint-disable-next-line @next/next/no-img-element -- decorative backdrop
        <img
          src="/unity/knot-wine.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[190px] -right-[140px] h-auto w-[560px] max-w-none"
        />
      ) : null}
      <div className="relative">{children}</div>
    </Tag>
  );
}

/** Serif panel heading. */
export function CabinetPanelTitle({
  children,
  tone = "ink",
  className = "",
}: {
  children: ReactNode;
  tone?: "ink" | "teal" | "light" | "red";
  className?: string;
}) {
  const colour = {
    ink: "text-ink",
    teal: "text-teal",
    light: "text-limestone",
    red: "text-brand",
  }[tone];
  return (
    <h2
      className={`m-0 font-serif text-[20px] font-semibold leading-[1.3] md:text-[22px] ${colour} ${className}`}
    >
      {children}
    </h2>
  );
}

/** Small spaced-capitals section label over a 2px ink rule. */
export function CabinetSectionLabel({
  children,
  aside,
  className = "",
}: {
  children: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 border-b-2 border-ink pb-3 ${className}`}
    >
      <h2 className="m-0 text-[12px] font-bold tracking-[.14em] text-ink md:text-[13px]">
        <Caps>{children}</Caps>
      </h2>
      {aside}
    </div>
  );
}

/** A label/value row on a hairline, as in the profile's personal-details list. */
export function CabinetDataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-5 border-b border-rule py-3.5">
      <span className="flex-none text-[15px] text-secondary">{label}</span>
      <span className="min-w-0 text-right font-serif text-[17px] font-bold">{children}</span>
    </div>
  );
}

/** The membership perks as a check list: sand ticks on wine, or green ticks on light paper. */
export function CabinetPerks({
  perks,
  tone = "wine",
}: {
  perks: readonly string[];
  tone?: "wine" | "light";
}) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {perks.map((perk) => (
        <li key={perk} className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3">
          <span
            aria-hidden="true"
            className={`mt-px inline-flex size-6 items-center justify-center rounded-full text-[13px] font-bold ${
              tone === "wine" ? "bg-sand text-wine" : "bg-ok/10 text-ok-deep"
            }`}
          >
            ✓
          </span>
          <span
            className={`text-[16px] leading-[1.55] md:text-[17px] ${tone === "wine" ? "text-limestone" : "text-ink"}`}
          >
            {perk}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A locked, already-verified value (phone, personal number) on a sandstone strip. */
export function CabinetReadonlyField({
  label,
  value,
  testId,
  badge,
  hint,
  spaced = false,
}: {
  label: string;
  value: string;
  testId?: string;
  badge?: ReactNode;
  hint?: string;
  spaced?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="text-[12px] font-bold tracking-[.12em] text-secondary">
        <Caps>{label}</Caps>
      </div>
      <span className="flex h-[46px] items-center gap-3 border-b border-rule bg-sandstone px-3.5">
        <input
          readOnly
          aria-label={label}
          value={value}
          data-testid={testId}
          className={`h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[17px] text-ink focus-visible:outline-none ${
            spaced ? "tracking-widest" : ""
          }`}
        />
        {badge}
      </span>
      {hint ? <p className="m-0 text-[13.5px] leading-[1.55] text-secondary">{hint}</p> : null}
    </div>
  );
}

/** The amber „working draft“ note: a bold line on a warm strip with a left rule. */
export function CabinetNote({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p
      role="note"
      data-testid={testId}
      className="m-0 border-l-4 border-warn bg-warn/10 px-[18px] py-3.5 text-[15px] font-bold leading-[1.55] text-warn-deep"
    >
      {children}
    </p>
  );
}

/** Cell classes for cabinet tables, used with DataTable (header labels go through Caps). */
export const cabinetThClass =
  "border-b-2 border-ink px-4 py-3 text-left text-[12px] font-bold tracking-[.12em] text-ink";
export const cabinetRowClass = "border-b border-rule";
export const cabinetCellClass = "px-4 py-3.5 text-[16px] text-ink";

/** A headline figure over a 2px ink rule: big serif number, bold label, optional quiet line. */
export function CabinetStat({
  value,
  label,
  sub,
  accent = false,
}: {
  value: number | string;
  label: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="border-t-2 border-ink pt-4 md:pt-5">
      <div
        className={`font-serif text-[48px] font-bold leading-[1.05] md:text-[64px] ${accent ? "text-brand" : "text-ink"}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[16px] font-bold text-ink">{label}</div>
      {sub ? <div className="mt-1 text-[14px] text-secondary">{sub}</div> : null}
    </div>
  );
}
