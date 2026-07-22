"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { adminControlClasses } from "@/components/Field";
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from "@/lib/content-schemas";
import { savePollAction } from "./actions";

export interface EditablePoll {
  id: string;
  question: string;
  options: string[];
  endsAtLocal: string;
}

interface OptionRow {
  key: number;
  value: string;
}

export function PollForm({ poll }: { poll: EditablePoll | null }) {
  const router = useRouter();
  const [question, setQuestion] = useState(poll?.question ?? "");
  const initialOptions = poll?.options ?? ["", ""];
  const [options, setOptions] = useState<OptionRow[]>(() =>
    initialOptions.map((value, key) => ({ key, value })),
  );
  const nextKey = useRef(initialOptions.length);
  const [endsAt, setEndsAt] = useState(poll?.endsAtLocal ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function setOption(key: number, value: string) {
    setOptions((prev) => prev.map((o) => (o.key === key ? { ...o, value } : o)));
  }

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await savePollAction({
        id: poll?.id,
        question,
        options: options.map((o) => o.value.trim()),
        endsAt,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!poll) {
        router.push(`/admin/content/polls/${result.id}`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        კითხვა
        <input
          className={adminControlClasses}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
        />
      </label>

      <div className="flex flex-col gap-2.5">
        {options.map((option, i) => (
          <div key={option.key} data-key={option.key} className="flex items-center gap-2">
            <label className="flex flex-1 flex-col gap-1.5 text-sm font-semibold text-ink">
              პასუხი {i + 1}
              <input
                className={adminControlClasses}
                value={option.value}
                onChange={(e) => setOption(option.key, e.target.value)}
                maxLength={120}
              />
            </label>
            {options.length > POLL_MIN_OPTIONS ? (
              <button
                type="button"
                aria-label="წაშალე პასუხი"
                className="mt-6 text-sm font-semibold text-muted-fg hover:text-danger"
                onClick={() => setOptions((prev) => prev.filter((o) => o.key !== option.key))}
              >
                ✕
              </button>
            ) : null}
          </div>
        ))}
        {options.length < POLL_MAX_OPTIONS ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOptions((prev) => [...prev, { key: nextKey.current++, value: "" }])}
          >
            პასუხის დამატება
          </Button>
        ) : null}
      </div>

      <label className="flex max-w-xs flex-col gap-1.5 text-sm font-semibold text-ink">
        ბოლო ვადა (არასავალდებულო)
        <input
          type="datetime-local"
          className={adminControlClasses}
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
      </label>
      <p className="text-xs text-muted-fg">
        გახსნის შემდეგ კითხვა და პასუხები იყინება. ვადის გასვლის შემდეგ ხმებს სერვერი აღარ იღებს.
      </p>

      <div className="flex items-center gap-3">
        <Button disabled={pending} onClick={submit}>
          შენახვა
        </Button>
        {saved ? <span className="text-sm font-semibold text-ok">შენახულია.</span> : null}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
