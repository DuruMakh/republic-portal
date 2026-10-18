"use client";
import { useCopy } from "@/lib/i18n/copy";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { localePath } from "@/lib/i18n/routing";
import { Caps } from "@/components/Caps";
import { CopyButton } from "@/components/CopyButton";
import { QrCode } from "@/components/QrCode";
import { MEMBER_STATUS_LABELS_KA } from "@/lib/admin";
import { buildReferralUrl } from "@/lib/cabinet";
import { formatCountKa } from "@/lib/format";

// ADR-039: the link's sign-ups, counted apart — supporters have not finished the
// membership form, members have. Both figures sum the person's own M- link and,
// once approved, their delegate link (owner decision 2026-07-29). The labels are the
// status vocabulary's own words, so the card always says what the status pill says.
const SUPPORTERS_LABEL = MEMBER_STATUS_LABELS_KA.registered;
const MEMBERS_LABEL = MEMBER_STATUS_LABELS_KA.profile_completed;

/**
 * Origin is read client-side so the link is truthful on every deployment
 * (previews show the preview URL, production the real one) — ADR-011.
 *
 * `teamNote` (fix-list round 2, Fix 3 — additive, defaults true): the closing
 * sentence claims everyone who signs up through the link is counted in "your
 * team". True for a delegate's own link, but this card also renders for
 * members and registered people (owner fix #12), whose link binds no team at
 * all, only a count. /delegate keeps the default; /me and /me/profile pass
 * false.
 *
 * `tone` („ერთობა“ redesign, additive): `light` is the chalk card with an ink border used
 * in the member cabinet; `wine` is the delegate panel's wine call-out.
 */
export function ReferralCard({
  code,
  supporters,
  members,
  teamNote = true,
  tone = "light",
}: {
  code: string;
  supporters: number;
  members: number;
  teamNote?: boolean;
  tone?: "light" | "wine";
}) {
  const t = useCopy();
  const locale = useLocale() === "en" ? "en" : "ka";
  const [url, setUrl] = useState<string>();
  const wine = tone === "wine";

  useEffect(() => {
    const referralUrl = new URL(buildReferralUrl(window.location.origin, code));
    referralUrl.pathname = localePath(referralUrl.pathname, locale);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- origin is only known client-side (ADR-011); synchronize the link when its code or language changes
    setUrl(referralUrl.toString());
  }, [code, locale]);

  return (
    <section
      className={`relative overflow-hidden p-6 md:p-8 ${
        wine
          ? "bg-wine text-sand [&_:focus-visible]:outline-limestone md:p-9"
          : "border border-ink bg-chalk text-ink"
      }`}
    >
      {wine ? (
        // eslint-disable-next-line @next/next/no-img-element -- decorative backdrop
        <img
          src="/unity/map-dots-dark.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-10 left-1/2 h-auto w-[760px] max-w-none -translate-x-1/2"
        />
      ) : null}
      <div className="relative">
        <p
          className={`m-0 text-[12px] font-bold tracking-[.14em] ${wine ? "text-sand" : "text-brand"}`}
        >
          <Caps>{t("შენი პერსონალური რეფერალური ბმული")}</Caps>
        </p>
        {url ? (
          <>
            <div
              className={`mt-4 flex items-center gap-3 py-2 pl-4 pr-2 ${
                wine ? "border border-limestone/20 bg-white/6" : "border border-rule bg-sandstone"
              }`}
            >
              <code
                className={`min-w-0 flex-1 font-mono text-[14.5px] [overflow-wrap:anywhere] ${
                  wine ? "text-limestone" : "text-ink"
                }`}
                data-testid="referral-url"
              >
                {url}
              </code>
              <CopyButton text={url} tone={wine ? "light" : "ink"} />
            </div>
            <div className="mt-6">
              <QrCode value={url} label={t("რეფერალური ბმულის QR კოდი")} size={180} />
            </div>
          </>
        ) : null}
        <dl className={`mt-[22px] mb-0 border-t ${wine ? "border-limestone/16" : "border-rule"}`}>
          {(
            [
              [SUPPORTERS_LABEL, supporters, "referral-supporters"],
              [MEMBERS_LABEL, members, "referral-members"],
            ] as const
          ).map(([label, value, testId], index) => (
            <div
              key={testId}
              className={`flex items-baseline justify-between gap-3 py-3 ${
                index === 0 ? (wine ? "border-b border-limestone/16" : "border-b border-rule") : ""
              }`}
            >
              <dt className={`text-[15px] ${wine ? "text-sand" : "text-secondary"}`}>{t(label)}</dt>
              <dd
                className={`m-0 font-serif text-[24px] font-bold ${wine ? "text-limestone" : "text-ink"}`}
                data-testid={testId}
              >
                {formatCountKa(value)}
              </dd>
            </div>
          ))}
        </dl>
        {teamNote ? (
          <p
            className={`mt-4 mb-0 text-[15px] leading-[1.6] ${wine ? "text-sand" : "text-secondary"}`}
            data-testid="referral-team-note"
          >
            {t("ყველა, ვინც ამ ბმულით დარეგისტრირდება, ავტომატურად შენს გუნდში ჩაითვლება.")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
