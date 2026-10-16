import Link from "next/link";
import type { ReactNode } from "react";
import { Caps } from "@/components/Caps";

/*
 * The admin register of the „ერთობა“ redesign (admin page of the owner's canvas): page header,
 * sub-tabs, section titles and ledger-table cells. Server-safe, no hooks.
 */

/** Ledger-table header cell: spaced Mtavruli over a 2px ink rule. Wrap the label in <Caps>. */
export const adminThClass =
  "relative whitespace-nowrap border-b-2 border-ink px-4 py-3 text-left text-[11.5px] font-bold tracking-[.12em] text-ink";
export const adminRowClass = "border-b border-rule";
export const adminTdClass = "px-4 py-[13px] align-middle text-[14.5px]";

/**
 * The page title block: a GL Gordeziani headline, an optional serif lede, and a 2px ink rule
 * under it. `meta` sits right after the title (a status chip, a count, a "see on the site"
 * link); `action` is pushed to the far end (a "new …" button).
 */
export function AdminPageHeader({
  title,
  person = false,
  lede,
  sub,
  meta,
  action,
}: {
  title: string;
  /** A person's name as the title: serif instead of the display face. */
  person?: boolean;
  lede?: ReactNode;
  /** A short line under the title (region · public page link). */
  sub?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-10 border-b-2 border-ink pb-8">
      <div className="flex flex-wrap items-end gap-x-7 gap-y-4">
        <h1
          className={
            person
              ? "font-serif text-[clamp(40px,4vw,56px)] leading-[1.1] font-bold text-balance"
              : "font-display text-[clamp(48px,4.4vw,64px)] leading-[.92] font-bold tracking-[-.005em] text-balance"
          }
        >
          {title}
        </h1>
        {meta ? (
          <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2.5 pb-1">{meta}</div>
        ) : null}
        {action ? <div className="ms-auto">{action}</div> : null}
      </div>
      {sub ? <p className="mt-2 text-[15px] text-secondary">{sub}</p> : null}
      {lede ? (
        <p className="mt-5 max-w-[38em] font-serif text-[21px] leading-[1.6] text-prose">{lede}</p>
      ) : null}
    </div>
  );
}

/** The second row of tabs inside a section (content: news / events / polls; verify: by status). */
export function AdminSubNav({
  label,
  items,
}: {
  label: string;
  items: readonly { href: string; label: string; active: boolean }[];
}) {
  return (
    <nav
      aria-label={label}
      className="relative mb-10 flex gap-8 overflow-x-auto whitespace-nowrap border-b border-rule text-[13px] font-bold tracking-[.08em]"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`border-b-2 pt-2.5 pb-2 no-underline transition-colors ${
            item.active ? "border-brand text-brand" : "border-transparent text-ink hover:text-brand"
          }`}
        >
          <Caps>{item.label}</Caps>
        </Link>
      ))}
    </nav>
  );
}

/** A section title inside an admin card: spaced Mtavruli over a 2px ink rule, with an optional action at the right. */
export function AdminSectionTitle({
  children,
  action,
  as: Tag = "h2",
  className = "",
}: {
  children: string;
  action?: ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 border-b-2 border-ink pb-3 ${className}`.trim()}
    >
      <Tag className="text-[13px] font-bold tracking-[.14em] text-ink">
        <Caps>{children}</Caps>
      </Tag>
      {action}
    </div>
  );
}

/** An overview figure: a large serif number over a 2px ink rule, a bold label and a small note. */
export function AdminStat({
  value,
  label,
  sub,
  accent = false,
  urgent = false,
}: {
  value: string;
  label: string;
  sub?: string;
  /** Red figure: the headline number of the screen (monthly income). */
  accent?: boolean;
  /** Red figure and an amber note: something waits for an admin (the verification queue). */
  urgent?: boolean;
}) {
  return (
    <div className="min-w-0 border-t-2 border-ink pt-4">
      <span
        className={`block font-serif text-[44px] leading-[1.05] font-bold ${accent || urgent ? "text-brand" : "text-ink"}`}
      >
        {value}
      </span>
      <span className="mt-2 block text-[15.5px] font-bold">{label}</span>
      {sub ? (
        <span
          className={`block text-[13.5px] ${urgent ? "font-bold text-warn-deep" : "text-secondary"}`}
        >
          {sub}
        </span>
      ) : null}
    </div>
  );
}
