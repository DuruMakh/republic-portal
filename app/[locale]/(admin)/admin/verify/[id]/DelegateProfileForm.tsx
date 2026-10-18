"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { adminControlClasses } from "@/components/Field";
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/lib/admin-schemas";
import type { SaveProfileResult } from "./actions";

export function DelegateProfileForm({
  delegateId,
  initialBio,
  photoUrl,
  save,
}: {
  delegateId: string;
  initialBio: string;
  photoUrl: string | null;
  save: (formData: FormData) => Promise<SaveProfileResult>;
}) {
  const [bio, setBio] = useState(initialBio);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    // FormData(form) trusts the form-associated file-selection algorithm for the
    // "photo" input's entry; read the input's own .files directly instead so the
    // real selected file is what's checked and sent, not a stale/empty snapshot.
    const fileInput = form.elements.namedItem("photo");
    const selected = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : undefined;
    if (selected) formData.set("photo", selected);
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      if (!PHOTO_TYPES[photo.type]) {
        setNotice({ kind: "error", text: "დაშვებულია მხოლოდ JPEG, PNG ან WebP ფოტო." });
        return;
      }
      if (photo.size > PHOTO_MAX_BYTES) {
        setNotice({ kind: "error", text: "ფოტო არ უნდა აღემატებოდეს 5 MB-ს." });
        return;
      }
    }
    setBusy(true);
    const result = await save(formData);
    setBusy(false);
    if (result.ok) setNotice({ kind: "ok", text: "პროფილი განახლდა ✓" });
    else setNotice({ kind: "error", text: result.error });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="delegateId" value={delegateId} />
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
        ბიოგრაფია (საჯარო გვერდზე ჩანს)
        <textarea
          name="bio"
          value={bio}
          maxLength={1000}
          rows={6}
          onChange={(e) => setBio(e.target.value)}
          className={adminControlClasses}
        />
        <span className="text-xs font-normal text-muted-fg">{bio.length} / 1000</span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
        ფოტო (JPEG/PNG/WebP, მაქს. 5 MB)
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm font-normal"
        />
      </label>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- storage-hosted; next/image host config is a Phase 6 item (spec §3.4)
        <img
          src={photoUrl}
          alt="დელეგატის მიმდინარე ფოტო"
          className="h-32 w-32 rounded-xl border border-line object-cover"
        />
      ) : (
        <p className="text-sm text-muted-fg">ფოტო ჯერ არ არის ატვირთული.</p>
      )}
      <div>
        <Button type="submit" variant="primary" disabled={busy}>
          შენახვა
        </Button>
      </div>
      {notice ? (
        <p className={`text-sm ${notice.kind === "ok" ? "text-ok" : "text-danger"}`}>
          {notice.text}
        </p>
      ) : null}
    </form>
  );
}
