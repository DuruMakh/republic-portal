import Link from "next/link";
import { Card } from "@/components/Card";
import { CountUp } from "@/components/CountUp";
import { Eyebrow } from "@/components/Eyebrow";
import { IndexRow } from "@/components/IndexRow";
import { SectionRule } from "@/components/SectionRule";
import { formatDateKa } from "@/lib/cabinet";
import { formatCountKa } from "@/lib/format";
import { rankDelegates } from "@/lib/ranking";
import {
  fetchPublicDelegates,
  fetchPublicNews,
  fetchPublicStats,
  fetchTransparencyStats,
} from "@/lib/supabase/public";

export const revalidate = 60;

// Manifesto block (kicker/headline/lede/two-column body) spliced -- never hand-retyped --
// from prototype/kronika-d3/kronika-d3-template.html via the Task-11 brief's Step 1 node
// snippet; every codepoint verified against the Georgian (Mkhedruli, U+10A0-U+10FF) Unicode
// block before commit. P2's membership clause is the OWNER-APPROVED CORRECTED clause
// (membership is a CHOICE of 5/10/20 GEL/month), replacing the mock's original fixed-price
// wording -- see .superpowers/sdd/task-11-brief.md Step 1 and the georgian-quote-
// transcription-hazard note (never retype Georgian by hand). P1 is rendered drop-cap: first
// letter (P1.slice(0, 1)) floated large, rest (P1.slice(1)) as body text, below.
const KICKER = "მანიფესტი";
const HEADLINE = "ავაშენოთ ქართული რესპუბლიკა ერთად";
const LEDE =
  "გამჭვირვალე სამოქალაქო მოძრაობა — ვერიფიცირებული დელეგატები, ღია რეიტინგი და საჯარო ფინანსები. შენს ხელში.";
const P1 =
  "რესპუბლიკა არ შენდება ერთი მოედნიდან — ის იწერება ათასობით ხელმოწერით, ყოველ მხარეში, ყოველდღე. ჩვენი პლატფორმა თითოეულ წევრს აძლევს დადასტურებულ ხმას: პირადი ნომრით, SMS კოდით, საკუთარი დელეგატის არჩევით.";
const P2 =
  "დელეგატები ლაგდებიან ღია რეიტინგში მხარდამჭერების მიხედვით; ყოველი ლარი აღირიცხება საჯარო დავთარში. წევრობის შენატანი არჩევითია — 5, 10 ან 20₾ თვეში — და ყველა გადაწყვეტილება შიდა გამოკითხვით მტკიცდება.";
const CONT = "გააგრძელე კითხვა →";
const BYLINE1 = "მოძრაობის რედაქცია";
const BYLINE2 = "3 წუთი კითხვა";
const STRIP = "როგორ შემოგვიერთდები";
const REG = "რეესტრი — დღეს";
const SRC = "წყარო: საჯარო დავთარი";
const TOP = "რეიტინგი — ხუთეული";
const FULL = "სრულად →";

// Ladder columns: fresh copy from the Task-11 brief's shipped vocabulary (Step 2), spliced
// -- never hand-retyped. Rail labels reused byte-exact from their existing shipped pages:
// the three counter labels from this file's own prior hero (git history), the collected-dues
// label from app/(public)/transparency/page.tsx, the supporter label from
// components/LeaderRow.tsx, and the finance nav label from app/(public)/layout.tsx.
const LADDER_1_TITLE = "რეგისტრირებული";
const LADDER_1_DESC = "სწრაფი რეგისტრაცია, გადახდის გარეშე.";
const LADDER_1_LINK = "რეგისტრაცია →";
const LADDER_2_TITLE = "წევრი";
const LADDER_2_PRICE = "5/10/20₾ თვეში";
const LADDER_2_DESC = "სრული წევრობა და შიდა გამოკითხვები — კაბინეტიდან.";
const LADDER_2_LINK = "დაიწყე რეგისტრაციით →";
const LADDER_3_TITLE = "დელეგატი";
const LADDER_3_DESC = "წევრებისთვის, დადასტურებით.";
const LADDER_3_LINK = "გაეცანი წესებს →";
const STAT_REGISTERED_LABEL = "რეგისტრირებული";
const STAT_ACTIVE_LABEL = "აქტიური წევრი";
const STAT_APPROVED_LABEL = "დამტკიცებული დელეგატი";
const TOTAL_GEL_LABEL = "შეგროვებული საწევრო შენატანები";
const SUPPORTER_LABEL = "მხარდამჭერი";
const NEWS_LABEL = "სიახლეები";
const FINANCE_LABEL = "ფინანსები";

export default async function HomePage() {
  const [stats, delegates, tStats, news] = await Promise.all([
    fetchPublicStats(),
    fetchPublicDelegates(),
    fetchTransparencyStats(),
    fetchPublicNews(),
  ]);
  const ranked = rankDelegates(delegates);

  return (
    <main>
      <div className="grid gap-0 px-5 pb-12 pt-8 sm:px-10 lg:grid-cols-[1fr_348px]">
        <div className="lg:border-r lg:border-hairline lg:pr-8">
          <Eyebrow>{KICKER}</Eyebrow>
          <h1 className="mt-2.5 font-serif text-[2rem] font-bold leading-[1.16] [text-wrap:balance] sm:text-[2.7rem]">
            {HEADLINE}
          </h1>
          <p className="mt-3.5 font-serif text-[1.12rem] leading-[1.6] text-prose">{LEDE}</p>
          <div className="mt-4 flex gap-3.5 border-y border-hairline py-2 text-[0.74rem] text-muted-fg">
            <span>{BYLINE1}</span>
            <span>·</span>
            <span>{BYLINE2}</span>
          </div>
          <div className="mt-4 grid gap-7 sm:grid-cols-2">
            <p className="text-[0.92rem] leading-[1.75] sm:text-justify">
              <span className="float-left pr-2.5 pt-1 font-serif text-[3.4rem] font-bold leading-[0.78] text-brand">
                {P1.slice(0, 1)}
              </span>
              {P1.slice(1)}
            </p>
            <p className="text-[0.92rem] leading-[1.75] sm:text-justify">
              {P2} <Link href="#join-strip">{CONT}</Link>
            </p>
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
                <div className="font-serif font-bold text-ink">
                  {LADDER_2_TITLE}{" "}
                  <span className="text-[0.7rem] font-bold text-brand">{LADDER_2_PRICE}</span>
                </div>
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
              <div className="flex justify-between border-b border-hairline py-2.5">
                <span className="text-[0.85rem] text-muted-fg">{TOTAL_GEL_LABEL}</span>
                <span className="font-serif text-xl font-bold">
                  {formatCountKa(tStats.total_gel)}₾
                </span>
              </div>
            </div>
            <p className="mt-2.5 text-[0.74rem] text-muted-fg">
              {SRC} · {formatDateKa(new Date().toISOString())} ·{" "}
              <Link href="/transparency">{FINANCE_LABEL}</Link>
            </p>
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
                  figureLabel={SUPPORTER_LABEL}
                  href={`/delegates/${d.slug}`}
                />
              ))}
            </div>
          </div>
          <Card variant="callout">
            <Eyebrow>{NEWS_LABEL}</Eyebrow>
            <div className="mt-3 flex flex-col gap-3">
              {news.slice(0, 3).map((n) => (
                <div key={n.id}>
                  <Link
                    href={`/news/${n.slug}`}
                    className="font-serif font-bold text-ink no-underline hover:text-brand"
                  >
                    {n.title}
                  </Link>
                  <p className="mt-0.5 text-[0.74rem] text-muted-fg">
                    {formatDateKa(n.published_at)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3">
              <Link href="/news">{FULL}</Link>
            </p>
          </Card>
        </aside>
      </div>
    </main>
  );
}
