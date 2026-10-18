"use client";
import { OriginalLanguageNote } from "@/components/OriginalLanguageNote";

import { useCopy } from "@/lib/i18n/copy";

import { useState, useTransition } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { formatCountKa } from "@/lib/format";
import { leadingOptions, type PollViewState } from "@/lib/community";
import { voteAction } from "./actions";

export interface PollCardOption {
  optionId: string;
  label: string;
  pct: number;
  votes: number;
  mine: boolean;
}

export function PollCard({
  pollId,
  question,
  view,
  deadlineKa,
  options,
  total,
}: {
  pollId: string;
  question: string;
  view: PollViewState;
  deadlineKa: string | null;
  options: PollCardOption[];
  total: number;
}) {
  const t = useCopy();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function vote(optionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await voteAction({ pollId, optionId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  // ADR-048: the leading answer (every answer tied for the most votes) stays red; the rest teal.
  const leading = leadingOptions(options.map((o) => o.votes));

  return (
    <section
      data-testid={`poll-${pollId}`}
      className={`border bg-chalk p-6 md:px-10 md:py-9 ${view === "buttons" ? "border-ink" : "border-rule"}`}
    >
      <h3
        lang="ka"
        className="m-0 font-serif text-[22px] font-semibold leading-[1.3] text-ink md:text-[26px]"
      >
        {question}
      </h3>
      <OriginalLanguageNote className="mt-2 mb-0 text-[14px] text-secondary" />
      {deadlineKa ? <p className="mt-2 mb-0 text-[14px] text-secondary">{deadlineKa}</p> : null}

      {view === "buttons" ? (
        <div className="mt-5 flex flex-col gap-2.5">
          {options.map((o) => (
            <button
              key={o.optionId}
              type="button"
              disabled={pending}
              onClick={() => vote(o.optionId)}
              className="min-h-[54px] w-full cursor-pointer border border-ink bg-chalk px-[18px] py-3 text-left text-[16px] font-semibold text-ink transition-colors hover:bg-ink hover:text-limestone disabled:pointer-events-none disabled:opacity-50"
            >
              <span lang="ka">{o.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <div className="flex flex-col gap-5">
            {options.map((o, i) => (
              <div key={o.optionId}>
                <div className="mb-2 flex items-baseline justify-between gap-4 text-[16px]">
                  <span className={leading[i] ? "font-bold text-ink" : "text-ink"}>
                    <span lang="ka">{o.label}</span>
                    {o.mine ? (
                      <span className="ms-2.5 text-[13px] font-bold text-brand">
                        {t("✓ შენი არჩევანი")}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-serif font-bold text-ink">{o.pct}%</span>
                </div>
                <div className="h-2 bg-sandstone">
                  <div
                    className={`h-2 ${leading[i] ? "bg-brand" : "bg-teal"}`}
                    style={{ width: `${o.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 mb-0 border-t border-rule pt-5 text-[14px] text-secondary">
            {view === "results-closed"
              ? `${t("გამოკითხვა დასრულებულია · სულ ")}${formatCountKa(total)}${t(" ხმა")}`
              : `${t("✓ შენ უკვე მიეცი ხმა · სულ ")}${formatCountKa(total)}${t(" ხმა")}`}
          </p>
        </div>
      )}

      {error ? (
        <p className="mt-4 mb-0 text-[15px] font-semibold text-brand">{t(error ?? "")}</p>
      ) : null}
    </section>
  );
}
