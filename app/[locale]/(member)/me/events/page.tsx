import { OriginalLanguageNote } from "@/components/OriginalLanguageNote";

import { formatEventTime, eventDayMonth } from "@/lib/i18n/format";

import { getCopy, getLocale } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabinetHead, CabinetPage, CabinetSectionLabel } from "@/components/CabinetPage";
import { Pill } from "@/components/Pill";
import { contentPill } from "@/lib/admin";
import { formatCountKa } from "@/lib/format";
import { rsvpOpen, splitEvents } from "@/lib/community";
import { showEvents } from "@/lib/events-switch";
import { createServerSupabase } from "@/lib/supabase/server";
import { EventRsvp } from "./EventRsvp";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  return { title: t("ღონისძიებები — ქართული რესპუბლიკა") };
}

export default async function MemberEventsPage() {
  const t = await getCopy();
  const locale = await getLocale();
  // Events hidden (the default, ADR-042): the page does not exist, even by its address.
  if (!showEvents()) notFound();
  const supabase = await createServerSupabase();
  const [eventsRes, countsRes, mineRes] = await Promise.all([
    supabase.from("public_events").select("*"),
    supabase.from("member_event_going_counts").select("*"),
    supabase.from("event_rsvps").select("event_id, status"),
  ]);
  if (eventsRes.error) throw new Error(`public_events failed: ${eventsRes.error.message}`);
  if (countsRes.error) throw new Error(`going counts failed: ${countsRes.error.message}`);
  if (mineRes.error) throw new Error(`own rsvps failed: ${mineRes.error.message}`);

  const nowIso = new Date().toISOString();
  const goingByEvent = new Map((countsRes.data ?? []).map((c) => [c.event_id, c.going]));
  const myStatusByEvent = new Map((mineRes.data ?? []).map((r) => [r.event_id, r.status]));
  const { upcoming, past } = splitEvents(eventsRes.data ?? [], nowIso);

  return (
    <CabinetPage>
      <CabinetHead
        title={t("ღონისძიებები")}
        lede={t("აღნიშნე დასწრება — გუნდი შენზეა დამოკიდებული.")}
      />
      <OriginalLanguageNote className="mt-4 text-[14px] text-secondary" />

      <CabinetSectionLabel className="mt-10 md:mt-12">{t("მომავალი")}</CabinetSectionLabel>
      <div className="mt-6 flex flex-col gap-3.5 md:mt-7">
        {upcoming.length === 0 ? (
          <p className="m-0 font-serif text-[18px] text-secondary">
            {t("მომავალი ღონისძიებები მალე გამოცხადდება.")}
          </p>
        ) : (
          upcoming.map((e) => {
            const cancelled = e.status === "cancelled";
            const date = eventDayMonth(e.starts_at, locale);
            return (
              <article
                key={e.id}
                className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-5 gap-y-4 border border-rule bg-chalk p-5 md:grid-cols-[110px_minmax(0,1fr)_auto] md:gap-x-7 md:px-7 md:py-6"
              >
                <div
                  className={`self-stretch border-r border-rule pr-4 text-center md:pr-6 ${
                    cancelled ? "text-secondary" : "text-brand"
                  }`}
                >
                  <span className="block font-serif text-[34px] font-bold leading-none md:text-[46px]">
                    {date?.day}
                  </span>
                  <span className="mt-1 block text-[13px] font-semibold text-secondary">
                    {date?.month}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="m-0 text-[14px] font-semibold text-secondary">
                    {formatEventTime(e.starts_at, e.ends_at, locale)} · {e.location}
                  </p>
                  <h3
                    lang="ka"
                    className="mt-1.5 mb-0 font-serif text-[20px] font-semibold leading-[1.35] text-ink md:text-[23px]"
                  >
                    {e.title}
                  </h3>
                  <p className="mt-1.5 mb-0 text-[15px] text-prose">
                    {t("სულ მოდის")}{" "}
                    <strong className="text-ink">
                      {formatCountKa(goingByEvent.get(e.id) ?? 0)}
                    </strong>{" "}
                    {t("მონაწილე")}
                  </p>
                </div>
                <div className="col-span-2 flex flex-wrap items-center gap-3.5 md:col-span-1 md:justify-end">
                  {cancelled ? <Pill {...contentPill("cancelled")} /> : null}
                  <EventRsvp
                    eventId={e.id}
                    status={myStatusByEvent.get(e.id) ?? null}
                    open={rsvpOpen(e, nowIso)}
                  />
                </div>
              </article>
            );
          })
        )}
      </div>

      {past.length > 0 ? (
        <>
          <CabinetSectionLabel className="mt-14 md:mt-16">{t("გასული")}</CabinetSectionLabel>
          <div className="mt-6 flex flex-col gap-2.5">
            {past.map((e) => (
              <div
                key={e.id}
                className="grid items-center gap-x-6 gap-y-1 border border-rule bg-sandstone px-5 py-4 md:grid-cols-[200px_minmax(0,1fr)_auto] md:px-6"
              >
                <span className="text-[14px] text-secondary">
                  {formatEventTime(e.starts_at, e.ends_at, locale)}
                </span>
                <span lang="ka" className="font-serif text-[17px] font-semibold text-ink">
                  {e.title}
                </span>
                {myStatusByEvent.get(e.id) === "going" ? (
                  <span className="text-[14px] font-bold text-ok-deep">{t("დაესწარი ✓")}</span>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </CabinetPage>
  );
}
