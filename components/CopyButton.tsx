"use client";

import { useEffect, useRef, useState } from "react";
import { Caps } from "@/components/Caps";

/**
 * Copy-to-clipboard in the „ერთობა“ look: a small square outline button with spaced capitals.
 * `tone="light"` is the limestone outline for wine panels.
 */
export function CopyButton({ text, tone = "ink" }: { text: string; tone?: "ink" | "light" }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (non-secure context) — keep the neutral label
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex h-10 flex-none cursor-pointer items-center justify-center whitespace-nowrap border bg-transparent px-4 text-[12px] font-bold tracking-[.08em] transition-colors ${
        tone === "light"
          ? "border-limestone/60 text-limestone hover:bg-limestone hover:text-wine"
          : "border-ink text-ink hover:bg-ink hover:text-limestone"
      }`}
    >
      <Caps>{copied ? "დაკოპირდა ✓" : "კოპირება"}</Caps>
    </button>
  );
}
