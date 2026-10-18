"use client";

import { useCopy } from "@/lib/i18n/copy";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/components/useFocusTrap";
import { OriginalLanguageNote } from "@/components/OriginalLanguageNote";
import { DOCUMENTS_CLOSE, DOCUMENTS_ZOOM, type DocumentFan } from "@/lib/archive-documents";

// Where each page lies in the fan (left, right, on top) and how it opens out while the fan is
// hovered.
const PLACEMENT = [
  "left-0 top-[12%] z-[1] w-[42%] [transform:rotate(-6deg)] sm:top-[11%] sm:w-[44%] group-hover/docs:[transform:rotate(-9deg)_translate(-18px,8px)]",
  "right-0 top-[16%] z-[1] w-[42%] [transform:rotate(5deg)] sm:top-[15%] sm:w-[44%] group-hover/docs:[transform:rotate(8deg)_translate(18px,10px)]",
  "left-[22%] top-0 z-[2] w-[56%] [transform:rotate(-1.5deg)] sm:left-[23%] sm:w-[54%] group-hover/docs:[transform:rotate(-.5deg)_translateY(-10px)] group-hover/docs:shadow-[0_2px_3px_rgba(26,22,17,.16),0_40px_70px_-24px_rgba(26,22,17,.55)]",
] as const;

/**
 * Three archive pages of the first republic, fanned out (homepage and About roots sections);
 * each opens large in a viewer with its caption. The viewer closes on its button, a click
 * outside the page, or Escape, and hands focus back to the page that opened it.
 * `frameClassName` sets the fan's proportions, `captionClassName` the caption's alignment.
 */
export function UnityDocumentFan({
  documents,
  caption,
  className = "",
  frameClassName = "aspect-[350/300] sm:aspect-[640/510]",
  captionClassName = "",
}: {
  documents: DocumentFan;
  caption: string;
  className?: string;
  frameClassName?: string;
  captionClassName?: string;
}) {
  const t = useCopy();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const opener = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpenIndex(null), []);

  useFocusTrap({ active: openIndex !== null, containerRef: dialogRef, onEscape: close });

  useEffect(() => {
    if (openIndex !== null || opener.current === null) return;
    triggers.current[opener.current]?.focus();
    opener.current = null;
  }, [openIndex]);

  const open = openIndex === null ? undefined : documents[openIndex];

  return (
    <figure className={`group/docs m-0 min-w-0 ${className}`}>
      <div className={`relative w-full ${frameClassName}`}>
        {documents.map((doc, index) => (
          <button
            key={doc.src}
            ref={(el) => {
              triggers.current[index] = el;
            }}
            type="button"
            aria-label={`${t(DOCUMENTS_ZOOM)} — ${t(doc.name)}`}
            onClick={() => {
              opener.current = index;
              setOpenIndex(index);
            }}
            className={`absolute block cursor-zoom-in border-0 bg-[#d9cdb6] p-0 shadow-[0_1px_2px_rgba(26,22,17,.16),0_3px_8px_rgba(26,22,17,.08),0_28px_56px_-22px_rgba(26,22,17,.5)] outline outline-1 -outline-offset-1 outline-ink/8 transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(.2,.7,.2,1)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand motion-reduce:transition-none ${PLACEMENT[index]}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- archive scan at a fixed size */}
            <img
              src={doc.src}
              alt=""
              width={doc.width}
              height={doc.height}
              loading="lazy"
              className="block h-auto w-full"
            />
          </button>
        ))}
      </div>
      <figcaption
        className={`mt-[18px] text-[12.5px] leading-[1.55] text-secondary sm:mt-[22px] sm:text-[13px] sm:leading-[1.6] ${captionClassName}`}
      >
        {t(caption)}
        <OriginalLanguageNote document />
      </figcaption>

      {open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={t(open.name)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-start gap-[18px] bg-ink/94 px-4 pb-7 pt-16 sm:justify-center sm:px-8 sm:pb-10 [&_:focus-visible]:outline-limestone"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={close}
            className="absolute inset-0 size-full cursor-zoom-out border-0 bg-transparent p-0"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- archive scan shown at full size */}
          <img
            src={open.src}
            alt={t(open.name)}
            width={open.width}
            height={open.height}
            className="pointer-events-none relative block h-auto max-h-[calc(100dvh-180px)] w-auto max-w-full shadow-[0_2px_4px_rgba(0,0,0,.3),0_40px_90px_rgba(0,0,0,.55)]"
          />
          <p className="pointer-events-none relative m-0 max-w-[46em] text-center text-[13px] leading-[1.6] text-sand sm:text-[14px]">
            {t(open.caption)}
            <OriginalLanguageNote document className="mt-2 block" />
          </p>
          <button
            type="button"
            aria-label={t(DOCUMENTS_CLOSE)}
            onClick={close}
            className="absolute right-4 top-4 flex size-12 cursor-pointer items-center justify-center border border-sand/60 bg-transparent p-0 text-limestone transition-colors hover:bg-limestone/12"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" className="block">
              <path d="M2 2 L18 18 M18 2 L2 18" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </button>
        </div>
      ) : null}
    </figure>
  );
}
