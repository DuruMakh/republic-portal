import { OriginalLanguageNote } from "@/components/OriginalLanguageNote";

import { formatEventTime } from "@/lib/i18n/format";

import { useLocale } from "next-intl";

import { useCopy } from "@/lib/i18n/copy";
import { CabinetPanel, CabinetPanelTitle } from "@/components/CabinetPage";
import { formatCountKa } from "@/lib/format";
import { type TeamRsvpEvent } from "@/lib/community";

export function TeamRsvpCard({ events }: { events: TeamRsvpEvent[] }) {
  const t = useCopy();
  const locale = useLocale() === "en" ? "en" : "ka";
  return (
    <div data-testid="team-rsvp">
      <CabinetPanel>
        <CabinetPanelTitle>{t("გუნდის RSVP")}</CabinetPanelTitle>
        {events.length === 0 ? (
          <p className="mt-3 mb-0 text-[15px] text-secondary">
            {t("მომავალი ღონისძიებები ჯერ არ არის.")}
          </p>
        ) : (
          <div className="mt-4">
            {events.map((e) => (
              <div key={e.eventId} className="border-b border-rule py-5">
                <p className="m-0 text-[14px] text-secondary">
                  {formatEventTime(e.startsAt, null, locale)}
                </p>
                <p lang="ka" className="mt-1.5 mb-0 font-serif text-[17px] font-bold text-ink">
                  {e.title}
                </p>
                <OriginalLanguageNote className="mt-2 mb-0 text-[14px] text-secondary" />
                {e.going.length > 0 ? (
                  <details className="mt-2">
                    <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 text-[15px] text-prose">
                      <GoingCount count={e.goingCount} />
                      <span className="font-bold text-brand underline decoration-brand/40 underline-offset-4">
                        {t("ვინ მოდის")}
                      </span>
                    </summary>
                    <ul className="mt-3 mb-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-[15px] text-ink">
                      {e.going.map((n, i) => (
                        <li key={i}>
                          {n.firstName} {n.lastName}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <p className="mt-2 mb-0 text-[15px] text-prose">
                    <GoingCount count={e.goingCount} />
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CabinetPanel>
    </div>
  );
}

function GoingCount({ count }: { count: number }) {
  const t = useCopy();
  return (
    <span>
      {t("შენი გუნდიდან მოდის ")}
      <strong className="text-ink">{formatCountKa(count)}</strong>
    </span>
  );
}
