"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { adminControlClasses } from "@/components/Field";
import { saveEventAction } from "./actions";

export interface EditableEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAtLocal: string;
  endsAtLocal: string;
}

export function EventForm({ event }: { event: EditableEvent | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [startsAt, setStartsAt] = useState(event?.startsAtLocal ?? "");
  const [endsAt, setEndsAt] = useState(event?.endsAtLocal ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveEventAction({
        id: event?.id,
        title,
        description,
        location,
        startsAt,
        endsAt,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!event) {
        router.push(`/admin/content/events/${result.id}`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        დასახელება
        <input
          className={adminControlClasses}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        ადგილმდებარეობა
        <input
          className={adminControlClasses}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={200}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          დაწყება
          <input
            type="datetime-local"
            className={adminControlClasses}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          დასრულება (არასავალდებულო)
          <input
            type="datetime-local"
            className={adminControlClasses}
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
      </div>
      <p className="text-xs text-muted-fg">დრო — თბილისის დროით.</p>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        აღწერა
        <textarea
          className={`${adminControlClasses} min-h-48`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
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
