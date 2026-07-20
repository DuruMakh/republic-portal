"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { deleteNewsAction, publishNewsAction, unpublishNewsAction } from "./actions";

export function ArticleActions({
  id,
  status,
  everPublished,
}: {
  id: string;
  status: "draft" | "published";
  everPublished: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
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
      if (after) after();
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {status === "draft" ? (
          <Button disabled={pending} onClick={() => run((i) => publishNewsAction(i))}>
            გამოქვეყნება
          </Button>
        ) : (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => run((i) => unpublishNewsAction(i))}
          >
            მოხსნა
          </Button>
        )}
        {status === "draft" && !everPublished ? (
          armed ? (
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                run(
                  (i) => deleteNewsAction(i),
                  () => router.push("/admin/content/news"),
                )
              }
            >
              დაადასტურე წაშლა
            </Button>
          ) : (
            <Button variant="ghost" disabled={pending} onClick={() => setArmed(true)}>
              წაშლა
            </Button>
          )
        ) : null}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
