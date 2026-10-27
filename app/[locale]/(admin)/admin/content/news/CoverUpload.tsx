"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/lib/admin-schemas";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { setNewsCoverAction } from "./actions";

export function CoverUpload({ newsId, imageUrl }: { newsId: string; imageUrl: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("აირჩიე ფაილი.");
      return;
    }
    if (!PHOTO_TYPES[file.type]) {
      setError("დაშვებულია მხოლოდ JPEG, PNG ან WebP სურათი.");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError("სურათი არ უნდა აღემატებოდეს 4 MB-ს.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("newsId", newsId);
      formData.set("cover", file);
      const result = await setNewsCoverAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError(GENERIC_FUNNEL_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage host not in next.config images (delegate-photo precedent)
        <img src={imageUrl} alt="" className="h-28 w-44 border border-hairline object-cover" />
      ) : (
        <p className="text-sm text-muted-fg">ყდა არ არის ატვირთული.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm"
        />
        <Button variant="ghost" size="sm" disabled={pending} onClick={submit}>
          ყდის ატვირთვა
        </Button>
      </div>
      <p className="text-xs text-muted-fg">
        JPEG/PNG/WebP, მაქს. 4 MB. გამოჩნდება ბარათზე და OG სურათად.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
