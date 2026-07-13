"use client";

import { useEffect, useRef } from "react";
import { formatCountKa } from "@/lib/format";

/** Renders the final value on the server; animates 0→value after hydration
 *  unless the visitor prefers reduced motion. */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const duration = 1100;
    const start = performance.now();
    let raf = requestAnimationFrame(function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatCountKa(Math.round(eased * value));
      if (progress < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span ref={ref}>{formatCountKa(value)}</span>;
}
