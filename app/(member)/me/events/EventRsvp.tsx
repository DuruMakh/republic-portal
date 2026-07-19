"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { rsvpAction } from "./actions";

export function EventRsvp({
  eventId,
  status,
  open,
}: {
  eventId: string;
  status: "going" | "cancelled" | null;
  open: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return <p className="text-sm font-semibold text-muted-fg">რეგისტრაცია დახურულია</p>;
  }
  const going = status === "going";

  function submit(next: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await rsvpAction({ eventId, going: next });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2" data-testid={`rsvp-${eventId}`}>
      <div className="flex items-center gap-3">
        {going ? (
          <>
            <span className="text-sm font-semibold text-ok">✓ შენ მოდიხარ</span>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => submit(false)}>
              გაუქმება
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={pending} onClick={() => submit(true)}>
            მოვალ
          </Button>
        )}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
