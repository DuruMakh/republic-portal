"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { formatCountKa } from "@/lib/format";
import type { PollViewState } from "@/lib/community";
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

  return (
    <div data-testid={`poll-${pollId}`}>
      <Card title={question}>
        {deadlineKa ? (
          <p className="mb-3 text-xs font-semibold text-muted-fg">{deadlineKa}</p>
        ) : null}

        {view === "buttons" ? (
          <div className="flex flex-col gap-2.5">
            {options.map((o) => (
              <Button
                key={o.optionId}
                variant="ghost"
                disabled={pending}
                onClick={() => vote(o.optionId)}
                className="w-full justify-start"
              >
                {o.label}
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {options.map((o) => (
              <div key={o.optionId}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink">
                    {o.label}
                    {o.mine ? (
                      <span className="ms-2 text-xs font-semibold text-brand">✓ შენი არჩევანი</span>
                    ) : null}
                  </span>
                  <span className="font-semibold text-muted-fg">{o.pct}%</span>
                </div>
                <div className="h-2 bg-surface">
                  <div className="h-2 bg-brand" style={{ width: `${o.pct}%` }} />
                </div>
              </div>
            ))}
            <p className="mt-1 text-xs text-muted-fg">
              {view === "results-closed"
                ? `გამოკითხვა დასრულებულია · სულ ${formatCountKa(total)} ხმა`
                : `✓ შენ უკვე მიეცი ხმა · სულ ${formatCountKa(total)} ხმა`}
            </p>
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </Card>
    </div>
  );
}
