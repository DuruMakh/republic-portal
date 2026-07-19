"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { closePollAction, deletePollAction, openPollAction } from "./actions";

export function PollActions({ id, status }: { id: string; status: "draft" | "open" | "closed" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState<"close" | "delete" | null>(null);
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
          <>
            <Button disabled={pending} onClick={() => run((i) => openPollAction(i))}>
              გახსნა
            </Button>
            {armed === "delete" ? (
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  run(
                    (i) => deletePollAction(i),
                    () => router.push("/admin/content/polls"),
                  )
                }
              >
                დაადასტურე წაშლა
              </Button>
            ) : (
              <Button variant="ghost" disabled={pending} onClick={() => setArmed("delete")}>
                წაშლა
              </Button>
            )}
          </>
        ) : null}
        {status === "open" ? (
          armed === "close" ? (
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => run((i) => closePollAction(i))}
            >
              დაადასტურე დახურვა
            </Button>
          ) : (
            <Button variant="ghost" disabled={pending} onClick={() => setArmed("close")}>
              დახურვა
            </Button>
          )
        ) : null}
        {status === "closed" ? (
          <p className="text-sm font-semibold text-muted-fg">გამოკითხვა დახურულია.</p>
        ) : null}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
