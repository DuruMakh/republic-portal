import Link from "@/lib/i18n/navigation";
import { useLocale } from "next-intl";
import { useCopy } from "@/lib/i18n/copy";
import { OriginalLanguageNote } from "@/components/OriginalLanguageNote";
import { contentPill } from "@/lib/admin";
import { eventDateBadge, formatEventTime } from "@/lib/i18n/format";
import type { PublicEventItem } from "@/lib/supabase/public";

/**
 * One event on the „ერთობა“ events list: a chalk row with the big red start day, the time,
 * serif title and place, and a cancelled tag. `past` greys the day and dims the row.
 */
export function EventRow({ event, past = false }: { event: PublicEventItem; past?: boolean }) {
  const locale = useLocale() === "en" ? "en" : "ka";
  const { day, monthYear } = eventDateBadge(event.starts_at, locale);
  const cancelled = event.status === "cancelled";
  return (
    <Link
      href={`/events/${event.slug}`}
      data-past={past ? "true" : undefined}
      className="grid grid-cols-[70px_minmax(0,1fr)] gap-3.5 border border-rule bg-chalk px-4 py-[18px] text-ink no-underline transition-colors hover:bg-white hover:text-ink data-[past=true]:opacity-[.78] sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center sm:gap-8 sm:px-7 sm:py-[22px]"
    >
      <span className="flex flex-col items-center justify-center border-r border-rule pr-3 text-center sm:pr-7">
        <span
          className={`text-[28px] font-black leading-none [font-stretch:62.5%] sm:text-[44px] ${
            past ? "text-secondary" : "text-brand"
          }`}
        >
          {day}
        </span>
        <span className="mt-1 text-[11px] font-bold tracking-[.1em] text-secondary sm:mt-1.5 sm:text-[12px] sm:tracking-[.12em]">
          {monthYear}
        </span>
      </span>
      {/* Phones read time, title, place; wide screens put the title first, time and place under it. */}
      <span className="grid min-w-0 grid-cols-1 content-center gap-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-5 sm:gap-y-1.5">
        <span
          lang="ka"
          className="font-serif text-[18px] font-semibold leading-[1.35] max-sm:order-2 sm:col-span-2 sm:text-[22px]"
        >
          {event.title}
        </span>
        <span className="text-[13.5px] font-semibold text-secondary max-sm:order-1 sm:text-[15px]">
          {formatEventTime(event.starts_at, event.ends_at, locale)}
        </span>
        <span lang="ka" className="text-[14px] text-secondary max-sm:order-3 sm:text-[15px]">
          {event.location}
        </span>
        <OriginalLanguageNote className="order-4 block text-[13px] text-secondary sm:col-span-2" />
        {cancelled ? (
          <span className="mt-1.5 max-sm:order-4 sm:hidden">
            <CancelledTag />
          </span>
        ) : null}
      </span>
      <span className="hidden items-center gap-[18px] sm:flex">
        {cancelled ? <CancelledTag /> : null}
        <span aria-hidden="true" className="text-[22px] text-brand">
          →
        </span>
      </span>
    </Link>
  );
}

function CancelledTag() {
  const t = useCopy();
  return (
    <span className="inline-flex h-[26px] items-center whitespace-nowrap border border-[#e3b3bc] bg-[#f6e3e6] px-2.5 text-[12px] font-bold leading-none tracking-[.04em] text-brand">
      {t(contentPill("cancelled").label)}
    </span>
  );
}
