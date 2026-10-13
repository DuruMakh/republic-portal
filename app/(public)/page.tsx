import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ButtonLink";
import { CountUp } from "@/components/CountUp";
import { EventRow } from "@/components/EventRow";
import { IndexRow } from "@/components/IndexRow";
import { NewsCard } from "@/components/NewsCard";
import { SectionRule } from "@/components/SectionRule";
import { ABOUT_GOAL_CORE, ABOUT_HREF, ABOUT_READ_MORE, ABOUT_TITLE } from "@/lib/about-copy";
import { formatDateKa } from "@/lib/cabinet";
import { splitEvents } from "@/lib/community";
import { excerpt } from "@/lib/content-render";
import { showEvents } from "@/lib/events-switch";
import { formatCountKa } from "@/lib/format";
import { PRINCIPLES, PRINCIPLES_HREF, PRINCIPLES_TITLE } from "@/lib/principles-copy";
import { showPublicFinances } from "@/lib/public-finances";
import { rankDelegates } from "@/lib/ranking";
import { CLOSING_CTA } from "@/lib/structure-copy";
import {
  fetchPublicDelegates,
  fetchPublicEvents,
  fetchPublicNews,
  fetchPublicStats,
  fetchTransparencyStats,
} from "@/lib/supabase/public";

export const revalidate = 60;

// Homepage copy supplied by the owner on 2026-10-07. Its four paragraphs gave way to the
// about-us section on 2026-10-13 (they repeated /about); the section keeps the drop cap.
const HEADLINE = "ერთად შევქმნათ ქართული რესპუბლიკა";
const LEDE = "იდეები მხოლოდ მაშინ ცვლიან ქვეყანას, როდესაც ადამიანები მათ გარშემო ერთიანდებიან.";
const STRIP = "როგორ შემოგვიერთდები";
const REG = "რეესტრი — დღეს";
const TOP = "რეიტინგი — ხუთეული";
const FULL = "სრულად →";

// Ladder columns and the supporter wording: the owner's 2026-10-07 copy round (ADR-035) —
// supporter is the free tier, so the registry counter says it too. With dues dropped there
// is no "active" tier (ADR-037): the member counter and a delegate's ranked figure count
// every member. The collected-dues label matches app/(public)/transparency/page.tsx.
const LADDER_1_TITLE = "მხარდამჭერი";
const LADDER_1_DESC = "მარტივი რეგისტრაცია მეილით და ტელეფონით.";
const LADDER_1_LINK = "გახდი მხარდამჭერი →";
const LADDER_2_TITLE = "წევრი";
const LADDER_2_DESC = "აყენებს ინიციატივებს და მონაწილეობს საერთო კენჭისყრაში.";
const LADDER_2_LINK = "დაიწყე რეგისტრაციით →";
const LADDER_3_TITLE = "დელეგატი";
const LADDER_3_DESC = "მოძრაობის წარმომადგენელი თავის ქალაქში, სოფელში, უბანში.";
const LADDER_3_LINK = "გაეცანი წესებს →";
const LADDER = [
  { title: LADDER_1_TITLE, desc: LADDER_1_DESC, link: LADDER_1_LINK, href: "/join" },
  { title: LADDER_2_TITLE, desc: LADDER_2_DESC, link: LADDER_2_LINK, href: "/join" },
  { title: LADDER_3_TITLE, desc: LADDER_3_DESC, link: LADDER_3_LINK, href: "/join/terms" },
] as const;
const STAT_REGISTERED_LABEL = "მხარდამჭერი";
const STAT_MEMBERS_LABEL = "წევრი";
const STAT_APPROVED_LABEL = "დამტკიცებული დელეგატი";
const TOTAL_GEL_LABEL = "შეგროვებული საწევრო შენატანები";
const RANK_FIGURE_LABEL = "წევრი";
const NEWS_LABEL = "სიახლეები";
const EVENTS_LABEL = "ღონისძიებები";
const NEWS_EMPTY = "სიახლეები მალე გამოჩნდება.";
const EVENTS_EMPTY = "მომავალი ღონისძიებები მალე გამოცხადდება.";

export default async function HomePage() {
  // The collected-dues figure is part of the hidden finance surface (ADR-034): no fetch,
  // no row, until SHOW_PUBLIC_FINANCES=true.
  const financesPublic = showPublicFinances();
  // Events are hidden by default too (ADR-042): no fetch and no section until SHOW_EVENTS=true.
  const eventsShown = showEvents();
  const [stats, delegates, tStats, news, events] = await Promise.all([
    fetchPublicStats(),
    fetchPublicDelegates(),
    financesPublic ? fetchTransparencyStats() : Promise.resolve(null),
    fetchPublicNews(),
    eventsShown ? fetchPublicEvents() : Promise.resolve([]),
  ]);
  const ranked = rankDelegates(delegates);
  const { upcoming } = splitEvents(events, new Date().toISOString());

  return (
    <main>
      <div className="grid gap-0 px-5 pb-12 pt-8 sm:px-10 lg:grid-cols-[1fr_348px]">
        <div className="lg:border-r lg:border-hairline lg:pr-8 lg:[container-type:inline-size]">
          <h1 className="font-serif text-[2rem] font-bold leading-[1.16] [text-wrap:balance] sm:text-[2.7rem] lg:text-[4cqw] lg:whitespace-nowrap">
            {HEADLINE}
          </h1>
          <p className="mt-3.5 font-serif text-[1.12rem] leading-[1.6] text-prose lg:text-[clamp(0.74rem,2.1cqw,1.12rem)] lg:whitespace-nowrap">
            {LEDE}
          </p>
          <section className="mt-6">
            <SectionRule label={ABOUT_TITLE} />
            <div className="mt-4 grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <p className="font-serif text-[1.05rem] leading-[1.75] text-prose">
                  <span className="float-left pr-2.5 pt-1 font-serif text-[3.4rem] font-bold leading-[0.78] text-brand">
                    {ABOUT_GOAL_CORE.slice(0, 1)}
                  </span>
                  {ABOUT_GOAL_CORE.slice(1)}
                </p>
                <p className="mt-3">
                  <Link href={ABOUT_HREF}>{ABOUT_READ_MORE}</Link>
                </p>
              </div>
              <Image
                src="/brand/emblem-roundel-red-notext.png"
                alt=""
                width={360}
                height={360}
                className="hidden w-[104px] sm:block"
              />
            </div>
          </section>
          <section className="mt-8">
            <SectionRule label={PRINCIPLES_TITLE} />
            <ol className="grid sm:grid-cols-2 sm:gap-x-8">
              {PRINCIPLES.map(({ title }, i) => (
                <li key={title}>
                  <Link
                    href={`${PRINCIPLES_HREF}#principle-${i + 1}`}
                    className="flex items-baseline gap-3 border-b border-hairline py-2.5 text-ink no-underline hover:text-brand"
                  >
                    <span className="w-6 shrink-0 font-serif font-bold text-brand">{i + 1}</span>{" "}
                    <span className="text-[0.88rem] font-semibold leading-snug">{title}</span>
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-3">
              <Link href={PRINCIPLES_HREF}>{ABOUT_READ_MORE}</Link>
            </p>
          </section>
          <div className="mt-10">
            <SectionRule label={NEWS_LABEL} action={<Link href="/news">{FULL}</Link>} />
            {news.length === 0 ? (
              <p className="mt-4 text-muted-fg">{NEWS_EMPTY}</p>
            ) : (
              <div className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-3">
                {news.slice(0, 3).map((n) => (
                  <NewsCard
                    variant="tile"
                    key={n.id}
                    href={`/news/${n.slug}`}
                    title={n.title}
                    publishedAt={formatDateKa(n.published_at)}
                    imageUrl={n.image_url}
                    excerptText={excerpt(n.body)}
                  />
                ))}
              </div>
            )}
          </div>
          {eventsShown ? (
            <div className="mt-10">
              <SectionRule label={EVENTS_LABEL} action={<Link href="/events">{FULL}</Link>} />
              {upcoming.length === 0 ? (
                <p className="mt-4 text-muted-fg">{EVENTS_EMPTY}</p>
              ) : (
                <div className="mt-6 flex flex-col gap-3">
                  {upcoming.slice(0, 3).map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
        <aside className="mt-8 flex flex-col gap-6 lg:mt-0 lg:pl-7">
          <div data-testid="registry">
            <SectionRule label={REG} tone="teal" />
            <div className="mt-1">
              <div className="flex justify-between border-b border-hairline py-2.5">
                <span className="text-[0.85rem] text-muted-fg">{STAT_APPROVED_LABEL}</span>
                <span
                  className="font-serif text-xl font-bold text-teal"
                  data-testid="stat-approved-delegates"
                >
                  <CountUp value={stats.approved_delegates} />
                </span>
              </div>
              <div className="flex justify-between border-b border-hairline py-2.5">
                <span className="text-[0.85rem] text-muted-fg">{STAT_MEMBERS_LABEL}</span>
                <span
                  className="font-serif text-xl font-bold text-teal"
                  data-testid="stat-members-total"
                >
                  <CountUp value={stats.members_total} />
                </span>
              </div>
              <div className="flex justify-between border-b border-hairline py-2.5">
                <span className="text-[0.85rem] text-muted-fg">{STAT_REGISTERED_LABEL}</span>
                <span
                  className="font-serif text-xl font-bold text-teal"
                  data-testid="stat-registered-total"
                >
                  <CountUp value={stats.registered_total} />
                </span>
              </div>
              {tStats ? (
                <div className="flex justify-between border-b border-hairline py-2.5">
                  <span className="text-[0.85rem] text-muted-fg">{TOTAL_GEL_LABEL}</span>
                  <span className="font-serif text-xl font-bold text-teal">
                    {formatCountKa(Math.round(tStats.total_gel))}₾
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          <div>
            <SectionRule label={TOP} action={<Link href="/leaderboard">{FULL}</Link>} />
            <div>
              {ranked.slice(0, 5).map((d) => (
                <IndexRow
                  key={d.id}
                  rank={d.rank}
                  name={`${d.first_name} ${d.last_name}`}
                  meta={d.region_name_ka ?? "—"}
                  figure={formatCountKa(d.members)}
                  figureLabel={RANK_FIGURE_LABEL}
                  href={`/delegates/${d.slug}`}
                />
              ))}
            </div>
          </div>
        </aside>
      </div>
      <section
        id="join-strip"
        className="border-t-2 border-ink bg-paper-bright px-5 py-[clamp(36px,5vw,64px)] sm:px-10"
      >
        <h2 className="display-heading text-center text-[clamp(2rem,4.2vw,3.2rem)] text-ink">
          {STRIP}
        </h2>
        <ol className="mx-auto mt-[clamp(24px,3vw,40px)] grid max-w-[1040px] gap-[clamp(20px,3vw,40px)] sm:grid-cols-3">
          {LADDER.map(({ title, desc, link, href }, i) => (
            <li key={title} className="border-t-2 border-ink pt-4">
              <span
                aria-hidden="true"
                className="block font-serif text-[clamp(2.6rem,4vw,3.4rem)] leading-none font-extrabold text-transparent [-webkit-text-stroke:1.5px_var(--color-brand)]"
              >
                {i + 1}
              </span>
              <div className="mt-3 font-serif text-[1.15rem] font-bold text-ink">{title}</div>
              <p className="mt-1 text-[0.88rem] leading-relaxed text-muted-fg">{desc}</p>
              <p className="mt-3">
                <Link href={href}>{link}</Link>
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-[clamp(28px,4vw,44px)] flex justify-center">
          <ButtonLink href="/join" size="lg">
            {CLOSING_CTA}
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
