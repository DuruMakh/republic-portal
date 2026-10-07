import Link from "next/link";
import { CountUp } from "@/components/CountUp";
import { EventRow } from "@/components/EventRow";
import { IndexRow } from "@/components/IndexRow";
import { NewsCard } from "@/components/NewsCard";
import { SectionRule } from "@/components/SectionRule";
import { formatDateKa } from "@/lib/cabinet";
import { splitEvents } from "@/lib/community";
import { excerpt } from "@/lib/content-render";
import { formatCountKa } from "@/lib/format";
import { showPublicFinances } from "@/lib/public-finances";
import { rankDelegates } from "@/lib/ranking";
import {
  fetchPublicDelegates,
  fetchPublicEvents,
  fetchPublicNews,
  fetchPublicStats,
  fetchTransparencyStats,
} from "@/lib/supabase/public";

export const revalidate = 60;

// Homepage copy supplied by the owner on 2026-10-07. P1 keeps its opening drop cap.
const HEADLINE = "ერთად შევქმნათ ქართული რესპუბლიკა";
const LEDE = "იდეები მხოლოდ მაშინ ცვლიან ქვეყანას, როდესაც ადამიანები მათ გარშემო ერთიანდებიან.";
const P1 =
  "ქართული რესპუბლიკის პორტალის მიზანია შექმნას სივრცე, სადაც ქართველი ხალხი გაერთიანდება, ორგანიზდება, აირჩევს საკუთარ წარმომადგენლებს და უშუალოდ მიიღებს მონაწილეობას გადაწყვეტილებების მიღებაში.";
const P2 =
  "საქართველო ეკუთვნის ხალხს და არა ვიწრო კორუმპირებულ ელიტას, რომელიც ჩვენს ხარჯზე მდიდრდება და ქვეყნის სიმდიდრეს პირად ქონებად აქცევს.";
const P3 =
  "საქართველოს უნდა მართავდნენ ადამიანები, რომლებიც ქართველ ხალხს ემსახურებიან და არა ოლიგარქებს.";
const P4 =
  "ჩვენ გვჯერა, რომ ერთად შეგვიძლია დავიბრუნოთ საქართველო და შევქმნათ ქვეყანა, სადაც ქართულ ოჯახს ღირსეული და მდიდარი ცხოვრების შესაძლებლობა აქვს, სახელმწიფო კი თითოეულ ადამიანს ემსახურება.";
const STRIP = "როგორ შემოგვიერთდები";
const REG = "რეესტრი — დღეს";
const TOP = "რეიტინგი — ხუთეული";
const FULL = "სრულად →";

// Ladder columns and the supporter wording: the owner's 2026-10-07 copy round (ADR-035) —
// supporter is the free tier, so the registry counter says it too and a delegate's ranked
// figure (active members) says so instead of supporter. The collected-dues label matches
// app/(public)/transparency/page.tsx.
const LADDER_1_TITLE = "მხარდამჭერი";
const LADDER_1_DESC = "მარტივი რეგისტრაცია მეილით და ტელეფონით.";
const LADDER_1_LINK = "გახდი მხარდამჭერი →";
const LADDER_2_TITLE = "წევრი";
const LADDER_2_DESC = "აყენებს ინიციატივებს და მონაწილეობს საერთო კენჭისყრაში.";
const LADDER_2_LINK = "დაიწყე რეგისტრაციით →";
const LADDER_3_TITLE = "დელეგატი";
const LADDER_3_DESC = "მოძრაობის წარმომადგენელი თავის ქალაქში, სოფელში, უბანში.";
const LADDER_3_LINK = "გაეცანი წესებს →";
const STAT_REGISTERED_LABEL = "მხარდამჭერი";
const STAT_ACTIVE_LABEL = "აქტიური წევრი";
const STAT_APPROVED_LABEL = "დამტკიცებული დელეგატი";
const TOTAL_GEL_LABEL = "შეგროვებული საწევრო შენატანები";
const RANK_FIGURE_LABEL = "აქტიური წევრი";
const NEWS_LABEL = "სიახლეები";
const EVENTS_LABEL = "ღონისძიებები";
const NEWS_EMPTY = "სიახლეები მალე გამოჩნდება.";
const EVENTS_EMPTY = "მომავალი ღონისძიებები მალე გამოცხადდება.";

export default async function HomePage() {
  // The collected-dues figure is part of the hidden finance surface (ADR-034): no fetch,
  // no row, until SHOW_PUBLIC_FINANCES=true.
  const financesPublic = showPublicFinances();
  const [stats, delegates, tStats, news, events] = await Promise.all([
    fetchPublicStats(),
    fetchPublicDelegates(),
    financesPublic ? fetchTransparencyStats() : Promise.resolve(null),
    fetchPublicNews(),
    fetchPublicEvents(),
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
          <div className="mt-4 grid gap-7 sm:grid-cols-2">
            <div className="space-y-4">
              <p className="text-[0.92rem] leading-[1.75] sm:text-justify">
                <span className="float-left pr-2.5 pt-1 font-serif text-[3.4rem] font-bold leading-[0.78] text-brand">
                  {P1.slice(0, 1)}
                </span>
                {P1.slice(1)}
              </p>
              <p className="text-[0.92rem] leading-[1.75] sm:text-justify">{P2}</p>
            </div>
            <div className="space-y-4">
              <p className="text-[0.92rem] leading-[1.75] sm:text-justify">{P3}</p>
              <p className="text-[0.92rem] leading-[1.75] sm:text-justify">{P4}</p>
            </div>
          </div>
          <div id="join-strip" className="mt-6">
            <SectionRule label={STRIP} />
            <div className="grid sm:grid-cols-3">
              <div className="border-b border-hairline py-4 sm:border-b-0 sm:border-r sm:py-0 sm:pr-4 last:border-0 sm:pl-4 first:pl-0">
                <div className="font-serif font-bold text-ink">{LADDER_1_TITLE}</div>
                <p className="mt-1 text-[0.8rem] text-muted-fg">{LADDER_1_DESC}</p>
                <p className="mt-2">
                  <Link href="/join">{LADDER_1_LINK}</Link>
                </p>
              </div>
              <div className="border-b border-hairline py-4 sm:border-b-0 sm:border-r sm:py-0 sm:pr-4 last:border-0 sm:pl-4 first:pl-0">
                <div className="font-serif font-bold text-ink">{LADDER_2_TITLE}</div>
                <p className="mt-1 text-[0.8rem] text-muted-fg">{LADDER_2_DESC}</p>
                <p className="mt-2">
                  <Link href="/join">{LADDER_2_LINK}</Link>
                </p>
              </div>
              <div className="border-b border-hairline py-4 sm:border-b-0 sm:border-r sm:py-0 sm:pr-4 last:border-0 sm:pl-4 first:pl-0">
                <div className="font-serif font-bold text-ink">{LADDER_3_TITLE}</div>
                <p className="mt-1 text-[0.8rem] text-muted-fg">{LADDER_3_DESC}</p>
                <p className="mt-2">
                  <Link href="/join/terms">{LADDER_3_LINK}</Link>
                </p>
              </div>
            </div>
          </div>
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
        </div>
        <aside className="mt-8 flex flex-col gap-6 lg:mt-0 lg:pl-7">
          <div>
            <SectionRule label={REG} />
            <div className="mt-1">
              <div className="flex justify-between border-b border-hairline py-2.5">
                <span className="text-[0.85rem] text-muted-fg">{STAT_APPROVED_LABEL}</span>
                <span
                  className="font-serif text-xl font-bold"
                  data-testid="stat-approved-delegates"
                >
                  <CountUp value={stats.approved_delegates} />
                </span>
              </div>
              <div className="flex justify-between border-b border-hairline py-2.5">
                <span className="text-[0.85rem] text-muted-fg">{STAT_ACTIVE_LABEL}</span>
                <span className="font-serif text-xl font-bold" data-testid="stat-active-members">
                  <CountUp value={stats.active_members} />
                </span>
              </div>
              <div className="flex justify-between border-b border-hairline py-2.5">
                <span className="text-[0.85rem] text-muted-fg">{STAT_REGISTERED_LABEL}</span>
                <span className="font-serif text-xl font-bold" data-testid="stat-registered-total">
                  <CountUp value={stats.registered_total} />
                </span>
              </div>
              {tStats ? (
                <div className="flex justify-between border-b border-hairline py-2.5">
                  <span className="text-[0.85rem] text-muted-fg">{TOTAL_GEL_LABEL}</span>
                  <span className="font-serif text-xl font-bold">
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
                  figure={formatCountKa(d.active_supporters)}
                  figureLabel={RANK_FIGURE_LABEL}
                  href={`/delegates/${d.slug}`}
                />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
