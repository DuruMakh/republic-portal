"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { ContentBody } from "@/components/ContentBody";
import { adminControlClasses } from "@/components/Field";
import { VISIBILITY_LABELS_KA } from "@/lib/admin";
import { saveNewsAction } from "./actions";

export interface EditableArticle {
  id: string;
  title: string;
  body: string;
  visibility: "public" | "members";
}

export function NewsForm({ article }: { article: EditableArticle | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(article?.title ?? "");
  const [body, setBody] = useState(article?.body ?? "");
  const [visibility, setVisibility] = useState<"public" | "members">(
    article?.visibility ?? "public",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveNewsAction({ id: article?.id, title, body, visibility });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!article) {
        router.push(`/admin/content/news/${result.id}`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          სათაური
          <input
            className={adminControlClasses}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
          />
        </label>

        <fieldset className="flex items-center gap-5 text-sm">
          <legend className="mb-1.5 font-semibold text-ink">ხილვადობა</legend>
          {(["public", "members"] as const).map((v) => (
            <label key={v} className="flex items-center gap-1.5 font-semibold text-muted-fg">
              <input
                type="radio"
                name="visibility"
                checked={visibility === v}
                onChange={() => setVisibility(v)}
              />
              {VISIBILITY_LABELS_KA[v]}
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          ტექსტი
          <textarea
            className={`${adminControlClasses} min-h-72 font-sans`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <p className="text-xs text-muted-fg">
          ცარიელი ხაზი იწყებს ახალ აბზაცს; ბმულები ავტომატურად აქტიურდება.
        </p>

        <div className="flex items-center gap-3">
          <Button disabled={pending} onClick={submit}>
            შენახვა
          </Button>
          {saved ? <span className="text-sm font-semibold text-ok">შენახულია.</span> : null}
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-muted-fg">გადახედვა</p>
        <div data-testid="news-preview" className="rounded-xl border border-line p-5">
          {body.trim() === "" ? (
            <p className="text-sm text-muted-fg">ტექსტი ჯერ ცარიელია.</p>
          ) : (
            <ContentBody body={body} />
          )}
        </div>
      </div>
    </div>
  );
}
