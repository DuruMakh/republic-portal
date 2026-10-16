"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UnityButton } from "@/components/UnityButton";
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
    return <p className="m-0 text-[15px] text-secondary">რეგისტრაცია დახურულია</p>;
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
      <div className="flex flex-wrap items-center gap-3.5">
        {going ? (
          <>
            <span className="text-[15px] font-bold text-ok-deep">✓ შენ მოდიხარ</span>
            <UnityButton variant="ghost" size="sm" disabled={pending} onClick={() => submit(false)}>
              გაუქმება
            </UnityButton>
          </>
        ) : (
          <UnityButton size="sm" disabled={pending} onClick={() => submit(true)}>
            მოვალ
          </UnityButton>
        )}
      </div>
      {error ? <p className="m-0 text-[14px] font-semibold text-brand">{error}</p> : null}
    </div>
  );
}
