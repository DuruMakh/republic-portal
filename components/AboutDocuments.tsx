"use client";

import { useEffect, useRef, useState } from "react";
import {
  ABOUT_DOCUMENTS,
  ABOUT_DOCUMENTS_CAPTION,
  ABOUT_DOCUMENTS_CLOSE,
  ABOUT_DOCUMENTS_ZOOM,
  type AboutDocument,
} from "@/lib/about-copy";

const SHADOW =
  "shadow-[0_1px_2px_rgba(26,22,17,.16),0_3px_8px_rgba(26,22,17,.08),0_28px_56px_-22px_rgba(26,22,17,.5)]";

// Where each page sits in the fan, and how it moves when the fan is hovered.
const PLACEMENT: Record<AboutDocument["id"], string> = {
  constitution:
    "left-0 top-[12%] z-[1] w-[42%] sm:w-[43%] [transform:rotate(-6deg)] group-hover:[transform:rotate(-9deg)_translate(-18px,8px)]",
  signatures:
    "right-0 top-[15%] z-[1] w-[42%] sm:w-[43%] [transform:rotate(5deg)] group-hover:[transform:rotate(8deg)_translate(18px,10px)]",
  act: `left-[22%] top-0 z-[2] w-[56%] [transform:rotate(-1.5deg)] group-hover:[transform:rotate(-.5deg)_translateY(-10px)] group-hover:shadow-[0_2px_3px_rgba(26,22,17,.16),0_40px_70px_-24px_rgba(26,22,17,.55)]`,
};

/**
 * The fan of three archive pages in the roots section. Each page is a button that opens it
 * large over a dark backdrop with its caption; the backdrop, the × button and Escape close it,
 * and focus returns to the page that opened it.
 */
export function AboutDocuments() {
  const [openId, setOpenId] = useState<AboutDocument["id"] | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = ABOUT_DOCUMENTS.find((doc) => doc.id === openId) ?? null;

  useEffect(() => {
    if (!openId) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      triggerRef.current?.focus();
    };
  }, [openId]);

  return (
    <>
      <figure className="group mt-[26px] max-w-[560px] sm:mt-10 min-[900px]:max-w-none">
        <div className="relative aspect-[350/290] w-full sm:aspect-[440/352]">
          {ABOUT_DOCUMENTS.map((doc) => (
            <button
              key={doc.id}
              type="button"
              aria-label={`${ABOUT_DOCUMENTS_ZOOM} — ${doc.name}`}
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setOpenId(doc.id);
              }}
              className={`absolute block cursor-zoom-in border-0 bg-[#d9cdb6] p-0 outline outline-1 -outline-offset-1 outline-ink/8 transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(.2,.7,.2,1)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-brand motion-reduce:transition-none ${SHADOW} ${PLACEMENT[doc.id]}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- archive scan at its own size */}
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
        <figcaption className="mt-4 text-[12.5px] leading-[1.55] text-secondary sm:mt-5 sm:text-[13px] sm:leading-[1.6]">
          {ABOUT_DOCUMENTS_CAPTION}
        </figcaption>
      </figure>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.name}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-[18px] bg-ink/94 px-5 pb-10 pt-16 sm:px-8 [&_:focus-visible]:outline-limestone"
        >
          <button
            type="button"
            aria-label={ABOUT_DOCUMENTS_CLOSE}
            onClick={() => setOpenId(null)}
            className="absolute inset-0 h-full w-full cursor-zoom-out border-0 bg-transparent p-0"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- archive scan at its own size */}
          <img
            src={open.src}
            alt={open.name}
            width={open.width}
            height={open.height}
            className="pointer-events-none relative block h-auto max-h-[calc(100%-72px)] w-auto max-w-full shadow-[0_2px_4px_rgba(0,0,0,.3),0_40px_90px_rgba(0,0,0,.55)]"
          />
          <p className="pointer-events-none relative m-0 max-w-[46em] text-center text-[14px] leading-[1.6] text-sand">
            {open.caption}
          </p>
          <button
            ref={closeRef}
            type="button"
            aria-label={ABOUT_DOCUMENTS_CLOSE}
            onClick={() => setOpenId(null)}
            className="absolute right-4 top-4 flex h-12 w-12 cursor-pointer items-center justify-center border border-sand/60 bg-transparent p-0 text-limestone"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" className="block">
              <path d="M2 2 L18 18 M18 2 L2 18" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </button>
        </div>
      ) : null}
    </>
  );
}
