import { languageAlternates, openGraphDefaults } from "@/lib/i18n/metadata";
import { getCopy, getLocale } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { UnityClosing } from "@/components/UnityClosing";
import { UnityNewsTile } from "@/components/UnityNewsTile";
import { UnityPageHead, UnitySectionLabel } from "@/components/UnityPageHead";
import { excerpt } from "@/lib/content-render";
import { formatDate } from "@/lib/i18n/format";
import { CONTACT_CLOSING_LINK } from "@/lib/public-pages-copy";
import { fetchPublicNews } from "@/lib/supabase/public";

export const revalidate = 60;

const TITLE = "სიახლეები";
const INTRO = "მოძრაობის სიახლეები და განცხადებები.";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  const locale = await getLocale();
  return {
    title: t(TITLE) + " — " + t("ქართული რესპუბლიკა"),
    description: t(INTRO),
    openGraph: { ...openGraphDefaults(locale), images: ["/og-default.png?v=civic-portal"] },
    ...languageAlternates("/news", locale),
  };
}

export default async function NewsPage() {
  const t = await getCopy();
  const locale = await getLocale();
  const news = await fetchPublicNews();
  const [lead, ...rest] = news;
  return (
    <main aria-labelledby="page-title">
      <UnityPageHead kicker={t("ქართული რესპუბლიკა")} title={t(TITLE)} intro={t(INTRO)} />
      <section className="pb-16 pt-2 sm:pb-[clamp(88px,9vw,136px)] sm:pt-0">
        <div className="unity-container">
          <UnitySectionLabel>{t(TITLE)}</UnitySectionLabel>
          {lead ? (
            <ul className="m-0 mt-6 flex list-none flex-col gap-7 p-0 sm:mt-0 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] sm:gap-x-[clamp(28px,3vw,44px)] sm:gap-y-14">
              <li className="sm:col-span-full sm:mb-[-12px]">
                <UnityNewsTile
                  lead
                  href={`/news/${lead.slug}`}
                  title={lead.title}
                  publishedAt={formatDate(lead.published_at, locale)}
                  imageUrl={lead.image_url}
                  excerptText={excerpt(lead.body)}
                />
              </li>
              {rest.map((n) => (
                <li key={n.id}>
                  <UnityNewsTile
                    href={`/news/${n.slug}`}
                    title={n.title}
                    publishedAt={formatDate(n.published_at, locale)}
                    imageUrl={n.image_url}
                    excerptText={excerpt(n.body)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 mt-8 text-secondary">{t("სიახლეები მალე გამოჩნდება.")}</p>
          )}
        </div>
      </section>
      <UnityClosing link={CONTACT_CLOSING_LINK} />
    </main>
  );
}
