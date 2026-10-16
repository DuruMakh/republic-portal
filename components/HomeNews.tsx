import Link from "next/link";
import { UnityKicker } from "@/components/UnityKicker";
import { UnityTextLink } from "@/components/UnityTextLink";
import { formatDateKa } from "@/lib/cabinet";
import { HOME_NEWS_ALL, HOME_NEWS_EMPTY, HOME_NEWS_TITLE } from "@/lib/home-copy";
import type { PublicNewsItem } from "@/lib/supabase/public";

// The unity-container's side padding: the phone's swipe row bleeds out to the screen edges.
const BLEED =
  "max-sm:-mx-[clamp(20px,4.5vw,72px)] max-sm:px-[clamp(20px,4.5vw,72px)] max-sm:scroll-px-[clamp(20px,4.5vw,72px)]";

/**
 * The latest news: three cards in a row, a sideways swipe row on the phone. A story without a
 * photo gets the design's hatched stand-in.
 */
export function HomeNews({ items }: { items: readonly PublicNewsItem[] }) {
  return (
    <section aria-labelledby="home-news-title" className="pb-10 sm:pb-[clamp(48px,5vw,76px)]">
      <div className="unity-container">
        <div className="flex items-center justify-between gap-4 border-t border-rule pt-8 sm:pt-[clamp(36px,3.5vw,52px)]">
          {/* The kicker is the visible title; the heading names the section for assistive tech. */}
          <h2 id="home-news-title" className="sr-only">
            {HOME_NEWS_TITLE}
          </h2>
          <div aria-hidden="true">
            <UnityKicker>{HOME_NEWS_TITLE}</UnityKicker>
          </div>
          <UnityTextLink href="/news" className="text-[15px] sm:text-[16px]">
            {HOME_NEWS_ALL}
          </UnityTextLink>
        </div>
        {items.length === 0 ? (
          <p className="m-0 mt-[22px] text-secondary sm:mt-8">{HOME_NEWS_EMPTY}</p>
        ) : (
          <ul
            className={`m-0 mt-[22px] flex list-none snap-x snap-mandatory gap-3.5 overflow-x-auto p-0 [scrollbar-width:none] sm:mt-8 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] sm:gap-[clamp(28px,3vw,44px)] sm:overflow-visible [&::-webkit-scrollbar]:hidden ${BLEED}`}
          >
            {items.map((item) => (
              <li key={item.id} className="w-[280px] flex-none snap-start sm:w-auto">
                <Link
                  href={`/news/${item.slug}`}
                  className="group/news flex flex-col text-ink no-underline hover:text-ink"
                >
                  {item.image_url ? (
                    // Raw <img>, not next/image: the photo is hosted in Supabase Storage, which is
                    // not a configured next/image host (same as NewsCard).
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt=""
                      loading="lazy"
                      className="block aspect-[3/2] w-full bg-sandstone object-cover"
                    />
                  ) : (
                    <span
                      data-news-placeholder
                      aria-hidden="true"
                      className="block aspect-[3/2] bg-sandstone bg-[repeating-linear-gradient(135deg,rgba(26,22,17,.05)_0_1px,transparent_1px_11px)]"
                    />
                  )}
                  <span className="mt-3 text-[13px] text-secondary sm:mt-[18px] sm:text-[14px]">
                    {formatDateKa(item.published_at)}
                  </span>
                  <span className="mt-1 font-serif text-[19px] font-semibold leading-[1.35] transition-colors group-hover/news:text-brand sm:mt-1.5 sm:text-[22px]">
                    {item.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
