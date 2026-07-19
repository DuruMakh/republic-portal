"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { cancelEventAction, deleteEventAction, publishEventAction } from "./actions";

export function EventActions({
  id,
  status,
  everPublished,
}: {
  id: string;
  status: "draft" | "published" | "cancelled";
  everPublished: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState<"cancel" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();

  function run(
    action: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>,
    after?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setArmed(null);
      if (after) after();
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {status === "draft" ? (
          <Button disabled={pending} onClick={() => run((i) => publishEventAction(i))}>
            გამოქვეყნება
          </Button>
        ) : null}
        {status === "published" ? (
          armed === "cancel" ? (
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => run((i) => cancelEventAction(i))}
            >
              დაადასტურე გაუქმება
            </Button>
          ) : (
            <Button variant="ghost" disabled={pending} onClick={() => setArmed("cancel")}>
              გაუქმება
            </Button>
          )
        ) : null}
        {status === "draft" && !everPublished ? (
          armed === "delete" ? (
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                run(
                  (i) => deleteEventAction(i),
                  () => router.push("/admin/content/events"),
                )
              }
            >
              დაადასტურე წაშლა
            </Button>
          ) : (
            <Button variant="ghost" disabled={pending} onClick={() => setArmed("delete")}>
              წაშლა
            </Button>
          )
        ) : null}
        {status === "cancelled" ? (
          <p className="text-sm font-semibold text-muted-fg">ღონისძიება გაუქმებულია.</p>
        ) : null}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
