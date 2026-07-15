"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";

export function CopyButton({ text }: { text: string }) {
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
    <Button size="sm" onClick={copy}>
      {copied ? "დაკოპირდა ✓" : "კოპირება"}
    </Button>
  );
}
