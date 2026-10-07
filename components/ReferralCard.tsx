"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
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
 */
export function ReferralCard({
  code,
  supporters,
  members,
  teamNote = true,
}: {
  code: string;
  supporters: number;
  members: number;
  teamNote?: boolean;
}) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- origin is only known client-side (ADR-011); one-time sync of the client-only URL, gated by `code`, not a cascading loop
    setUrl(buildReferralUrl(window.location.origin, code));
  }, [code]);

  return (
    <Card variant="callout">
      <p className="text-xs font-extrabold uppercase tracking-wider text-brand">
        შენი პერსონალური რეფერალური ბმული
      </p>
      {url ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3 border border-hairline bg-surface p-3">
            <code
              className="min-w-0 flex-1 break-all font-mono text-sm text-ink"
              data-testid="referral-url"
            >
              {url}
            </code>
            <CopyButton text={url} />
          </div>
          <div className="mt-4">
            <QrCode value={url} label="რეფერალური ბმულის QR კოდი" size={180} />
          </div>
        </>
      ) : null}
      <dl className="mt-3 border-t border-hairline pt-3">
        {(
          [
            [SUPPORTERS_LABEL, supporters, "referral-supporters"],
            [MEMBERS_LABEL, members, "referral-members"],
          ] as const
        ).map(([label, value, testId]) => (
          <div key={testId} className="flex items-baseline justify-between gap-3">
            <dt className="text-[0.74rem] text-muted-fg">{label}</dt>
            <dd className="font-serif text-xl font-bold text-ink" data-testid={testId}>
              {formatCountKa(value)}
            </dd>
          </div>
        ))}
      </dl>
      {teamNote ? (
        <p className="mt-3 text-xs text-muted-fg" data-testid="referral-team-note">
          ყველა, ვინც ამ ბმულით დარეგისტრირდება, ავტომატურად შენს გუნდში ჩაითვლება.
        </p>
      ) : null}
    </Card>
  );
}
