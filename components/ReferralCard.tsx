"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { CopyButton } from "@/components/CopyButton";
import { QrCode } from "@/components/QrCode";
import { buildReferralUrl } from "@/lib/cabinet";
import { formatCountKa } from "@/lib/format";

// Spliced byte-exact (never hand-typed) from the delegate panel's registered-count
// StatCard label — app/(delegate)/delegate/page.tsx's
// `<StatCard value={panel.registeredCount} label="რეგისტრირებული" />` (owner fix #12).
const REGISTERED_LABEL = "რეგისტრირებული";

/**
 * Origin is read client-side so the link is truthful on every deployment
 * (previews show the preview URL, production the real one) — ADR-011.
 */
export function ReferralCard({ code, count }: { code: string; count: number }) {
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
      <p className="mt-3 flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
        <span className="text-[0.74rem] text-muted-fg">{REGISTERED_LABEL}</span>
        <span className="font-serif text-xl font-bold text-ink" data-testid="referral-count">
          {formatCountKa(count)}
        </span>
      </p>
      <p className="mt-3 text-xs text-muted-fg">
        ყველა, ვინც ამ ბმულით დარეგისტრირდება, ავტომატურად შენს გუნდში ჩაითვლება.
      </p>
    </Card>
  );
}
